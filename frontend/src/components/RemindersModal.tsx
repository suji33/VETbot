import React, { useState, useEffect } from 'react';
import { getReminders, createReminder, deleteReminder, type ReminderData, getPets, type PetData } from '../api/client';
import { ClockIcon, XIcon, StethoscopeIcon, PetBadgeIcon, TrashIcon } from './Icons';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SCHEDULES = [
  { label: 'Every morning at 8:00 AM', cron: '0 8 * * *' },
  { label: 'Twice daily (8:00 AM & 8:00 PM)', cron: '0 8,20 * * *' },
  { label: 'Every Monday morning (9:00 AM)', cron: '0 9 * * 1' },
  { label: 'Every 1st of the month (10:00 AM)', cron: '0 10 1 * *' },
  { label: 'Custom Cron Expression', cron: 'custom' },
];

export const RemindersModal: React.FC<RemindersModalProps> = ({ isOpen, onClose }) => {
  const [reminders, setReminders] = useState<ReminderData[]>([]);
  const [pets, setPets] = useState<PetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ReminderData['type']>('medication');
  const [petName, setPetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(PRESET_SCHEDULES[0].cron);
  const [customCron, setCustomCron] = useState('0 8 * * *');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [remList, petList] = await Promise.all([getReminders(), getPets()]);
      setReminders(remList || []);
      setPets(petList || []);
      if (petList && petList.length > 0 && !petName) {
        setPetName(petList[0].name);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load reminders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);

    const cronExpression = selectedPreset === 'custom' ? customCron.trim() : selectedPreset;

    try {
      await createReminder({
        title: title.trim(),
        type,
        petName: petName.trim() || undefined,
        cronExpression,
        description: description.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isRecurring: true,
        notificationChannel: 'in-app',
      });

      setTitle('');
      setDescription('');
      setShowAddForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to schedule reminder');
    }
  };

  const handleDeleteReminder = async (id?: string) => {
    if (!id) return;
    try {
      await deleteReminder(id);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel reminder');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2 text-brand-400">
            <ClockIcon className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Care Reminders & Automation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl p-3">
              {error}
            </div>
          )}

          {!showAddForm ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-gray-400">
                  Automated Node-cron & n8n webhook notifications for medicine, feeding & appointments.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  + New Reminder
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading reminders...</div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-surface-border rounded-xl">
                  <div className="flex justify-center mb-2 text-gray-500">
                    <ClockIcon className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-gray-300 font-medium">No active reminders</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Set up schedules or ask PetCare AI directly: "Remind me to give Bruno medicine daily at 9am".
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reminders.map((rem) => (
                    <div
                      key={rem._id}
                      className="bg-surface-bg border border-surface-border rounded-xl p-4 flex items-start justify-between hover:border-brand-500/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-brand-950/60 border border-brand-800/50 text-brand-400">
                            {rem.type === 'medication' ? (
                              <StethoscopeIcon className="w-3.5 h-3.5" />
                            ) : rem.type === 'followup' ? (
                              <StethoscopeIcon className="w-3.5 h-3.5" />
                            ) : (
                              <ClockIcon className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <h3 className="font-semibold text-white text-sm">{rem.title}</h3>
                          {rem.petName && (
                            <span className="text-[11px] bg-brand-900/40 border border-brand-700/50 text-brand-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <PetBadgeIcon className="w-3 h-3 inline" />
                              {rem.petName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono">
                          Cron: <span className="text-brand-300">{rem.cronExpression}</span>
                        </p>
                        {rem.description && (
                          <p className="text-xs text-gray-400 mt-1">{rem.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Status: {rem.status || 'Active'}</span>
                          <span>• Channel: {rem.notificationChannel || 'in-app'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteReminder(rem._id)}
                        className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-surface-hover rounded transition-colors"
                        title="Cancel reminder"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Reminder Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Heartworm Chewable Dosage"
                  className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="medication" className="bg-[#1a1f30] text-white">Medication</option>
                    <option value="feeding" className="bg-[#1a1f30] text-white">Feeding Schedule</option>
                    <option value="vaccination" className="bg-[#1a1f30] text-white">Vaccination</option>
                    <option value="followup" className="bg-[#1a1f30] text-white">Clinical Vet Follow-up</option>
                    <option value="other" className="bg-[#1a1f30] text-white">General Care</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Pet</label>
                  {pets.length > 0 ? (
                    <select
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="" className="bg-[#1a1f30] text-white">General (No specific pet)</option>
                      {pets.map((p) => (
                        <option key={p._id} value={p.name} className="bg-[#1a1f30] text-white">
                          {p.name} ({p.species})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="e.g. Bruno"
                      className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Schedule Frequency</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 mb-2"
                >
                  {PRESET_SCHEDULES.map((p) => (
                    <option key={p.cron} value={p.cron} className="bg-[#1a1f30] text-white">
                      {p.label}
                    </option>
                  ))}
                </select>

                {selectedPreset === 'custom' && (
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Cron Expression (min hour day-of-month month day-of-week)
                    </label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="0 8 * * *"
                      className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs font-mono text-brand-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Instructions / Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Give 1 tablet with wet food after breakfast"
                  className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-1.5 rounded-lg border border-surface-border text-gray-300 hover:text-white text-xs hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-md transition-colors"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
