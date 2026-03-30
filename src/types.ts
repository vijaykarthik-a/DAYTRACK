import { Timestamp } from './firebase';

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  timezone?: string;
  createdAt: Timestamp;
  enabledModules?: string[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  dueDate?: Timestamp;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  subtasks?: Subtask[];
  userId: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Timestamp;
  endTime: Timestamp;
  reminderMin?: number;
  color?: string;
  userId: string;
  isGoogle?: boolean;
  htmlLink?: string;
  googleEventId?: string;
}

export interface FocusSession {
  id: string;
  sessionType: 'pomodoro' | 'custom';
  durationMin: number;
  startedAt: Timestamp;
  completed: boolean;
  taskId?: string;
  userId: string;
}

export interface Routine {
  id: string;
  title: string;
  timeOfDay: string;
  daysOfWeek: number[];
  isActive: boolean;
  color?: string;
  userId: string;
}

export interface RoutineLog {
  id: string;
  routineId: string;
  logDate: string; // YYYY-MM-DD
  done: boolean;
  userId: string;
}

export interface StudySubject {
  id: string;
  title: string;
  color: string;
  userId: string;
}

export interface StudyNote {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  userId: string;
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
}
