import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  X, 
  BookOpen, 
  Trash2, 
  MessageSquare, 
  Calendar as CalendarIcon,
  Send,
  Save,
  Loader2,
  Upload,
  FileText
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, updateDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { StudySubject, StudyNote } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { format } from 'date-fns';

import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Study: React.FC = () => {
  const { user, googleAccessToken, connectGoogleCalendar } = useAuth();
  
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('bg-blue-500');

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Note editing state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const subjectsQuery = query(collection(db, 'study_subjects'), where('userId', '==', user.uid));
    const unsubSubjects = onSnapshot(subjectsQuery, (snapshot) => {
      const fetchedSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySubject));
      setSubjects(fetchedSubjects);
      if (fetchedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(fetchedSubjects[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'study_subjects'));

    const eventsQuery = query(collection(db, 'calendar_events'), where('userId', '==', user.uid));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      setCalendarEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'calendar_events'));

    return () => {
      unsubSubjects();
      unsubEvents();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedSubjectId) return;

    const notesQuery = query(collection(db, 'study_notes'), where('userId', '==', user.uid), where('subjectId', '==', selectedSubjectId));
    const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyNote));
      setNotes(fetchedNotes);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'study_notes'));

    return () => unsubNotes();
  }, [user, selectedSubjectId]);

  useEffect(() => {
    if (selectedNoteId) {
      const note = notes.find(n => n.id === selectedNoteId);
      if (note) {
        setNoteTitle(note.title);
        setNoteContent(note.content);
      }
    } else {
      setNoteTitle('');
      setNoteContent('');
    }
  }, [selectedNoteId, notes]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSubjectTitle.trim()) return;

    try {
      const newSub = await addDoc(collection(db, 'study_subjects'), {
        title: newSubjectTitle,
        color: newSubjectColor,
        userId: user.uid,
      });
      setSelectedSubjectId(newSub.id);
      setIsAddSubjectModalOpen(false);
      setNewSubjectTitle('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'study_subjects');
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm('Delete this subject and all its notes?')) return;
    try {
      await deleteDoc(doc(db, 'study_subjects', id));
      if (selectedSubjectId === id) setSelectedSubjectId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `study_subjects/${id}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedSubjectId) return;

    let text = '';
    
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let pdfText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(' ');
          pdfText += pageText + '\\n';
        }
        text = pdfText;
      } catch (error) {
        console.error("Error reading PDF:", error);
        alert("Failed to read PDF file.");
        e.target.value = '';
        return;
      }
    } else {
      text = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve((event.target?.result as string) || '');
        reader.readAsText(file);
      });
    }

    if (text) {
      try {
        const newNote = await addDoc(collection(db, 'study_notes'), {
          subjectId: selectedSubjectId,
          title: file.name,
          content: text.substring(0, 30000), // Limit length for safety
          userId: user.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        setSelectedNoteId(newNote.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'study_notes');
      }
    }
    
    e.target.value = '';
  };

  const handleCreateNote = async () => {
    if (!user || !selectedSubjectId) return;
    try {
      const newNote = await addDoc(collection(db, 'study_notes'), {
        subjectId: selectedSubjectId,
        title: 'Untitled Note',
        content: '',
        userId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setSelectedNoteId(newNote.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'study_notes');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNoteId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'study_notes', selectedNoteId), {
        title: noteTitle || 'Untitled Note',
        content: noteContent,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `study_notes/${selectedNoteId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteDoc(doc(db, 'study_notes', id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `study_notes/${id}`);
    }
  };

  const handleScheduleStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      let googleEventId = undefined;
      let htmlLink = undefined;

      if (googleAccessToken) {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `Study: ${scheduleTitle}`,
            description: `Study session scheduled via DailyFlow.`,
            start: { dateTime: new Date(scheduleStart).toISOString() },
            end: { dateTime: new Date(scheduleEnd).toISOString() },
          })
        });

        if (response.ok) {
          const data = await response.json();
          googleEventId = data.id;
          htmlLink = data.htmlLink;
          alert("Study session scheduled in Google Calendar!");
        } else {
          console.error('Failed to create Google calendar event');
        }
      }

      await addDoc(collection(db, 'calendar_events'), {
        title: `${selectedSubject?.title || 'Study'}: ${scheduleTitle}`,
        startTime: Timestamp.fromDate(new Date(scheduleStart)),
        endTime: Timestamp.fromDate(new Date(scheduleEnd)),
        color: '#8b5cf6', // A nice purple for study
        userId: user.uid,
        ...(googleEventId ? { googleEventId, htmlLink } : {})
      });
      
      if (!googleAccessToken) {
        alert("Study session added to Calendar!");
      }

      setIsScheduleModalOpen(false);
      setScheduleTitle('');
      setScheduleStart('');
      setScheduleEnd('');
    } catch (error) {
      console.error(error);
      alert("Failed to schedule event.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMsg = currentMessage;
    setCurrentMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add GEMINI_API_KEY to the Secrets panel in AI Studio.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Gather all notes for context
      const contextNotes = notes.map(n => `Title: ${n.title}\nContent:\n${n.content}`).join('\n\n---\n\n');
      const systemInstruction = `You are a helpful study assistant. Use the following notes provided by the user to answer their questions. If the answer is not in the notes, use your general knowledge but mention that it's not in their notes.\n\nUser's Notes:\n${contextNotes}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error connecting to AI assistant: ${error.message || 'Unknown error'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedSubjectId || notes.length === 0) {
      alert("Please add some notes to this subject first.");
      return;
    }
    
    const userMsg = "Generate a short quiz (3-5 questions) based on my notes to test my knowledge.";
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add GEMINI_API_KEY to the Secrets panel in AI Studio.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const contextNotes = notes.map(n => `Title: ${n.title}\nContent:\n${n.content}`).join('\n\n---\n\n');
      const systemInstruction = `You are a helpful study assistant. Use the following notes provided by the user to answer their questions. If the answer is not in the notes, use your general knowledge but mention that it's not in their notes.\n\nUser's Notes:\n${contextNotes}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error connecting to AI assistant: ${error.message || 'Unknown error'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGeneratePodcast = async () => {
    if (!selectedSubjectId || notes.length === 0) {
      alert("Please add some notes to this subject first.");
      return;
    }
    
    const userMsg = "Generate an 'Audio Overview' Transcript. It should be a dynamic, fun, 2-speaker podcast (hosts named Alex and Sam) analyzing and summarizing these notes. Use expressive text like [laugh] and tone markers.";
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is missing.");
      const ai = new GoogleGenAI({ apiKey });
      const contextNotes = notes.map(n => `Title: ${n.title}\nContent:\n${n.content}`).join('\n\n---\n\n');
      const systemInstruction = `You are a helpful study assistant. Use the following notes provided by the user to answer their questions.\n\nUser's Notes:\n${contextNotes}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
        config: { systemInstruction }
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error connecting to AI assistant: ${error.message || 'Unknown error'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedSubjectId || notes.length === 0) {
      alert("Please add some notes to this subject first.");
      return;
    }
    
    const userMsg = "Generate a comprehensive Study Guide from my notes. Include a summary, key terms, and FAQs.";
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add GEMINI_API_KEY to the Secrets panel in AI Studio.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const contextNotes = notes.map(n => `Title: ${n.title}\nContent:\n${n.content}`).join('\n\n---\n\n');
      const systemInstruction = `You are a helpful study assistant. Use the following notes provided by the user to answer their questions. If the answer is not in the notes, use your general knowledge but mention that it's not in their notes.\n\nUser's Notes:\n${contextNotes}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMsg,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text || 'Sorry, I could not generate a response.' }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error connecting to AI assistant: ${error.message || 'Unknown error'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const upcomingStudyEvents = calendarEvents
    .filter(e => {
        if (!e.startTime) return false;
        try {
            return new Date(e.startTime.toDate()).getTime() > Date.now() && e.color === '#8b5cf6';
        } catch {
            return false;
        }
    })
    .sort((a, b) => new Date(a.startTime.toDate()).getTime() - new Date(b.startTime.toDate()).getTime())
    .slice(0, 5);

  return (
    <div className="md:h-[calc(100vh-5rem)] flex flex-col pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Notebook LM</h1>
          <p className="text-on-surface-variant">Manage subjects, upload source texts, and chat with your AI tutor.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!googleAccessToken && (
            <button 
              onClick={connectGoogleCalendar}
              className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-low text-on-surface px-4 py-2 rounded-xl font-bold transition-all shadow-sm text-sm"
            >
              <CalendarIcon size={16} className="text-primary" />
              Connect Calendar
            </button>
          )}
          <button 
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-xl font-bold transition-all shadow-md text-sm"
          >
            <Plus size={16} />
            Add Subject
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Side Panels */}
        <div className="w-full md:w-64 flex flex-col gap-4 shrink-0 overflow-y-auto max-h-[30vh] md:max-h-none dark-scrollbar">
          {/* Subjects Sidebar */}
          <div className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/20 shadow-sm p-4 flex flex-col">
            <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-4 px-2">Subjects</h2>
            <div className="space-y-2">
              {subjects.map(subject => (
                <div 
                  key={subject.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group",
                    selectedSubjectId === subject.id ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                  )}
                  onClick={() => {
                    setSelectedSubjectId(subject.id);
                    setSelectedNoteId(null);
                  }}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={cn("w-3 h-3 rounded-full shrink-0", subject.color)} />
                    <span className={cn(
                      "font-bold truncate text-sm",
                      selectedSubjectId === subject.id ? "text-primary" : "text-on-surface"
                    )}>{subject.title}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subject.id); }}
                    className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {subjects.length === 0 && (
                <p className="text-sm text-on-surface-variant px-2 text-center py-4">No subjects yet.</p>
              )}
            </div>
          </div>

          {/* Upcoming Sessions List */}
          <div className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/20 shadow-sm p-4 flex flex-col flex-1 min-h-0">
            <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-4 px-2">Upcoming Sessions</h2>
            <div className="space-y-2 overflow-y-auto">
              {upcomingStudyEvents.map(event => (
                <div key={event.id} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                  <h3 className="font-bold text-on-surface text-sm truncate">{event.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1.5 font-medium">
                    <CalendarIcon size={12} />
                    {format(event.startTime.toDate(), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
              {upcomingStudyEvents.length === 0 && (
                <p className="text-xs text-on-surface-variant px-2 text-center py-2">No upcoming study sessions scheduled.</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {selectedSubjectId ? (
          <div className="flex-1 flex flex-col xl:flex-row gap-6 min-w-0">
            {/* Notes Section */}
            <div className="flex-1 flex flex-col bg-surface-container-lowest rounded-[2rem] border border-outline-variant/20 shadow-sm overflow-hidden min-h-[50vh]">
              <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low/50">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  <h2 className="font-bold text-on-surface">Sources & Notes</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="flex items-center gap-2 text-xs font-bold bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant px-3 py-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
                  >
                    <CalendarIcon size={14} /> Schedule
                  </button>
                  <label className="flex items-center gap-2 text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface hover:bg-surface-container-low px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                    <Upload size={14} /> Upload PDF/Text
                    <input type="file" accept=".txt,.md,.csv,.pdf,application/pdf" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button 
                    onClick={handleCreateNote}
                    className="flex items-center gap-2 text-xs font-bold bg-primary-container/30 text-primary px-3 py-1.5 rounded-lg hover:bg-primary-container/50 transition-colors"
                  >
                    <Plus size={14} /> New Note
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col sm:flex-row min-h-0">
                {/* Notes List */}
                <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r border-outline-variant/20 overflow-y-auto p-2 space-y-1 max-h-[30vh] sm:max-h-none">
                  <div className="px-2 py-1 mb-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{notes.length} Sources</div>
                  {notes.map(note => (
                    <div 
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={cn(
                        "p-3 rounded-xl cursor-pointer transition-all group flex justify-between items-start",
                        selectedNoteId === note.id ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn(
                          "font-bold text-sm truncate",
                          selectedNoteId === note.id ? "text-primary" : "text-on-surface"
                        )}>{note.title}</p>
                        <p className="text-xs text-on-surface-variant truncate mt-1">{note.content || 'Empty note'}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                        className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-sm text-on-surface-variant text-center py-8">Create a note to start studying.</p>
                  )}
                </div>

                {/* Note Editor */}
                <div className="flex-1 flex flex-col bg-surface-container-lowest">
                  {selectedNoteId ? (
                    <>
                      <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
                        <input 
                          type="text"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          className="text-lg font-bold text-on-surface bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-on-surface-variant/50"
                          placeholder="Note Title"
                        />
                        <button 
                          onClick={handleSaveNote}
                          disabled={isSaving}
                          className="flex items-center gap-2 text-xs font-bold bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0 ml-4"
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                      </div>
                      <textarea 
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="flex-1 w-full p-6 resize-none border-none focus:ring-0 text-on-surface leading-relaxed bg-transparent placeholder:text-on-surface-variant/50"
                        placeholder="Start typing your notes here..."
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">
                      Select a note to edit
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Assistant Chat */}
            <div className="w-full xl:w-80 flex flex-col bg-surface-container-highest rounded-[2rem] shadow-xl overflow-hidden shrink-0 min-h-[50vh]">
              <div className="p-4 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-container/30 flex items-center justify-center">
                  <MessageSquare size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-on-surface text-sm">NotebookLM Chat</h2>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{notes.length} sources loaded</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="px-4 pt-4 pb-2 flex gap-2 overflow-x-auto dark-scrollbar shrink-0">
                <button 
                  onClick={handleGeneratePodcast}
                  disabled={isAiLoading}
                  className="shrink-0 text-xs flex items-center gap-1 font-bold bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  🎧 Audio Overview (Transcript)
                </button>
                <button 
                  onClick={handleSummarize}
                  disabled={isAiLoading}
                  className="shrink-0 text-xs font-bold bg-surface-container-low hover:bg-surface-container text-on-surface px-3 py-1.5 rounded-lg transition-colors border border-outline-variant/20 disabled:opacity-50"
                >
                  Study Guide
                </button>
                <button 
                  onClick={handleGenerateQuiz}
                  disabled={isAiLoading}
                  className="shrink-0 text-xs font-bold bg-surface-container-low hover:bg-surface-container text-on-surface px-3 py-1.5 rounded-lg transition-colors border border-outline-variant/20 disabled:opacity-50"
                >
                  Generate Quiz
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-on-surface-variant text-sm">Ask me anything about your notes in {selectedSubject?.title}!</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "max-w-[85%] rounded-2xl p-3 text-sm",
                    msg.role === 'user' 
                      ? "bg-primary text-on-primary ml-auto rounded-tr-sm" 
                      : "bg-surface-container text-on-surface mr-auto rounded-tl-sm"
                  )}>
                    {msg.role === 'ai' ? (
                      <div className="markdown-body text-sm">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                ))}
                {isAiLoading && (
                  <div className="bg-surface-container text-on-surface-variant mr-auto rounded-2xl rounded-tl-sm p-3 text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 bg-surface-container-lowest border-t border-outline-variant/20">
                <div className="relative">
                  <input 
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Ask about your notes..."
                    className="w-full bg-surface-container border border-outline-variant/20 text-on-surface text-sm rounded-xl pl-4 pr-10 py-3 focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/50"
                  />
                  <button 
                    type="submit"
                    disabled={!currentMessage.trim() || isAiLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-outline-variant/20 shadow-sm">
            <div className="text-center">
              <BookOpen size={48} className="mx-auto text-on-surface-variant/30 mb-4" />
              <h3 className="text-xl font-black text-on-surface mb-2">Select a Subject</h3>
              <p className="text-on-surface-variant">Choose a subject from the sidebar or create a new one.</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Subject Modal */}
      {isAddSubjectModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200 border border-outline-variant/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">New Subject</h2>
              <button onClick={() => setIsAddSubjectModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubject} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Subject Name</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  placeholder="e.g. Computer Science 101" 
                  className="w-full px-6 py-4 bg-surface-container border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg font-bold text-on-surface placeholder:text-on-surface-variant/50"
                  value={newSubjectTitle}
                  onChange={(e) => setNewSubjectTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Color</label>
                <div className="flex gap-3">
                  {['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500', 'bg-orange-500', 'bg-emerald-500'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSubjectColor(color)}
                      className={cn(
                        "w-10 h-10 rounded-full transition-all",
                        color,
                        newSubjectColor === color ? 'ring-4 ring-outline-variant/30 scale-110' : 'hover:scale-105'
                      )}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all mt-4 uppercase tracking-widest"
              >
                Create Subject
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Study Session Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200 border border-outline-variant/20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">Schedule Study</h2>
              <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleScheduleStudy} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Topic</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  placeholder={`e.g. Review ${selectedSubject?.title} chapter 4`}
                  className="w-full px-6 py-4 bg-surface-container border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface placeholder:text-on-surface-variant/50"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Start Time</label>
                <input 
                  type="datetime-local" 
                  required
                  className="w-full px-6 py-4 bg-surface-container border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">End Time</label>
                <input 
                  type="datetime-local" 
                  required
                  className="w-full px-6 py-4 bg-surface-container border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all mt-4 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <CalendarIcon size={20} />
                Add to Calendar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Study;
