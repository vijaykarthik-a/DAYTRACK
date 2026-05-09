import React from 'react';
import { motion } from 'motion/react';

export default function Tournament() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-on-background tracking-tighter font-headline mb-4">
          Gaming Tournament
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          Register for one game and compete in Duo format. Follow official game rules and play fair. Be ready for scheduled matches and coordinate with your teammate.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Options */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">sports_esports</span>
            </div>
            <h2 className="text-2xl font-black text-on-surface font-headline">Game Options</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
              <span className="font-bold text-lg text-on-surface">E-FOOTBALL</span>
              <span className="material-symbols-outlined text-primary">sports_soccer</span>
            </div>
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
              <span className="font-bold text-lg text-on-surface">FREEFIRE</span>
              <span className="material-symbols-outlined text-primary">local_fire_department</span>
            </div>
          </div>
        </motion.div>

        {/* Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">gavel</span>
            </div>
            <h2 className="text-2xl font-black text-on-surface font-headline">Rules</h2>
          </div>
          <ul className="space-y-3">
            {[
              "Mode: Duo (2v2)",
              "8 minutes per match",
              "Extra Time: ON",
              "Penalties: ON",
              "Substitutions: 5 players",
              "Knockout format applies",
              "Coordinator's decision is final"
            ].map((rule, idx) => (
              <li key={idx} className="flex items-start gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-tertiary text-sm mt-1">check_circle</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Regulations */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h2 className="text-2xl font-black text-on-surface font-headline">Regulations</h2>
          </div>
          <ul className="space-y-3">
            {[
              "Team size is fixed at Duo.",
              "Participants must be present for their match times.",
              "Repeated rule violations may lead to disqualification."
            ].map((reg, idx) => (
              <li key={idx} className="flex items-start gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-error text-sm mt-1">priority_high</span>
                <span>{reg}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Evaluation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">military_tech</span>
            </div>
            <h2 className="text-2xl font-black text-on-surface font-headline">Evaluation</h2>
          </div>
          <ul className="space-y-3">
            {[
              "Match performance and results",
              "Team coordination",
              "Sportsmanship and fairness"
            ].map((evalItem, idx) => (
              <li key={idx} className="flex items-start gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-secondary text-sm mt-1">star</span>
                <span>{evalItem}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Registration CTA */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 bg-primary text-on-primary p-8 rounded-[2rem] shadow-lg shadow-primary/20 flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div>
          <h3 className="text-2xl font-black font-headline mb-2">Ready to compete?</h3>
          <p className="text-primary-container/80">Find your duo partner and register for the tournament now.</p>
        </div>
        <button className="bg-on-primary text-primary px-8 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-surface-container-lowest transition-colors whitespace-nowrap">
          Register Team
        </button>
      </motion.div>
    </div>
  );
}
