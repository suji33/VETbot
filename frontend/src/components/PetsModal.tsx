import React, { useState, useEffect } from 'react';
import { getPets, createPet, deletePet, type PetData } from '../api/client';
import { PetBadgeIcon, DogIcon, CatIcon, TrashIcon, XIcon } from './Icons';

interface PetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PetsModal: React.FC<PetsModalProps> = ({ isOpen, onClose }) => {
  const [pets, setPets] = useState<PetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<string>('dog');
  const [breed, setBreed] = useState('');
  const [ageMonths, setAgeMonths] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [sex, setSex] = useState<'male' | 'female' | 'unknown'>('male');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPets = async () => {
    setIsLoading(true);
    try {
      const data = await getPets();
      setPets(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPets();
    }
  }, [isOpen]);

  const handleCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSuccessMessage(null);

    try {
      const parsedAge = ageMonths !== '' && !isNaN(Number(ageMonths)) ? Number(ageMonths) : undefined;
      const parsedWeight = weightKg !== '' && !isNaN(Number(weightKg)) ? Number(weightKg) : undefined;

      const created = await createPet({
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        age: parsedAge,
        weightKg: parsedWeight,
        sex,
        notes: notes.trim() || undefined,
      });

      if (created) {
        setPets((prev) => [created, ...prev.filter((p) => p._id !== created._id)]);
      }

      setName('');
      setBreed('');
      setAgeMonths('');
      setWeightKg('');
      setNotes('');
      setShowAddForm(false);
      setSuccessMessage(`✓ ${created.name || 'Pet'} saved successfully to MongoDB Atlas!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchPets();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.details?.[0]?.message || 'Failed to create pet profile');
    }
  };

  const handleDeletePet = async (id?: string) => {
    if (!id) return;
    try {
      await deletePet(id);
      setPets((prev) => prev.filter((p) => p._id !== id));
      await fetchPets();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete pet');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-border">
          <div className="flex items-center gap-2 text-brand-400">
            <PetBadgeIcon className="w-5 h-5 text-brand-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-white">Pet Profiles</h2>
            <span className="hidden xs:inline-block sm:inline-block text-[10px] bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 px-2 py-0.5 rounded-full font-medium ml-1">
              Atlas Synced
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {successMessage && (
            <div className="bg-emerald-950/50 border border-emerald-600 text-emerald-300 text-xs rounded-xl p-3 flex items-center gap-2 shadow-sm animate-fade-in">
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl p-3">
              {error}
            </div>
          )}

          {!showAddForm ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-gray-400">
                  Registered pets are used to personalize nutrition, reminders, and medical advice.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  + Add Pet
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading pets...</div>
              ) : pets.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-surface-border rounded-xl">
                  <div className="flex justify-center mb-2 text-gray-500">
                    <DogIcon className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-gray-300 font-medium">No pet profiles yet</p>
                  <p className="text-xs text-gray-500 mt-1">Add your pet to get tailored guidance and automatic context.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pets.map((pet) => (
                    <div
                      key={pet._id}
                      className="bg-surface-bg border border-surface-border rounded-xl p-4 flex items-start justify-between hover:border-brand-500/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-brand-400">
                            {pet.species === 'cat' ? (
                              <CatIcon className="w-4 h-4" />
                            ) : pet.species === 'dog' ? (
                              <DogIcon className="w-4 h-4" />
                            ) : (
                              <PetBadgeIcon className="w-4 h-4" />
                            )}
                          </span>
                          <h3 className="font-semibold text-white text-sm">{pet.name}</h3>
                          <span className="text-[11px] bg-brand-900/40 border border-brand-700/50 text-brand-300 px-2 py-0.5 rounded-full capitalize">
                            {pet.species}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {pet.breed ? `${pet.breed} • ` : ''}
                          {pet.age ? `${Math.floor(pet.age / 12)}y ${pet.age % 12}m • ` : ''}
                          {pet.weightKg ? `${pet.weightKg} kg • ` : ''}
                          <span className="capitalize">{pet.sex || 'Unknown'}</span>
                        </p>
                        {pet.notes && (
                          <p className="text-xs text-gray-500 italic mt-1">{pet.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePet(pet._id)}
                        className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-surface-hover rounded transition-colors"
                        title="Delete pet profile"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreatePet} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Pet Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bruno"
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Species *</label>
                  <select
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="dog" className="bg-[#1a1f30] text-white">Dog 🐶</option>
                    <option value="cat" className="bg-[#1a1f30] text-white">Cat 🐱</option>
                    <option value="bird" className="bg-[#1a1f30] text-white">Bird / Parrot 🦜</option>
                    <option value="rabbit" className="bg-[#1a1f30] text-white">Rabbit / Bunny 🐰</option>
                    <option value="guinea pig" className="bg-[#1a1f30] text-white">Guinea Pig 🐹</option>
                    <option value="hamster" className="bg-[#1a1f30] text-white">Hamster / Small Rodent</option>
                    <option value="ferret" className="bg-[#1a1f30] text-white">Ferret 🦡</option>
                    <option value="reptile" className="bg-[#1a1f30] text-white">Reptile / Lizard 🦎</option>
                    <option value="turtle" className="bg-[#1a1f30] text-white">Turtle / Tortoise 🐢</option>
                    <option value="fish" className="bg-[#1a1f30] text-white">Fish / Aquatic 🐠</option>
                    <option value="horse" className="bg-[#1a1f30] text-white">Horse 🐴</option>
                    <option value="other" className="bg-[#1a1f30] text-white">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Breed</label>
                  <input
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="e.g. Golden Retriever"
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Sex</label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value as any)}
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="male" className="bg-[#1a1f30] text-white">Male</option>
                    <option value="female" className="bg-[#1a1f30] text-white">Female</option>
                    <option value="unknown" className="bg-[#1a1f30] text-white">Unknown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Age (months)</label>
                  <input
                    type="number"
                    min="0"
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 24"
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 15.5"
                    className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Notes / Diet / Allergies</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Allergic to chicken, loves carrots, taking joint supplements"
                  className="w-full bg-[#101420] border border-[#2e354c] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 h-20 resize-none"
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
                  Save Profile
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
