export type LoadType = 'weight_reps' | 'bodyweight_reps' | 'weighted_bodyweight' | 'duration';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  category: string;
  load_type: LoadType;
  is_unilateral: boolean;
  /** Metabolic equivalent — kept in data for later use, not surfaced in UI. */
  met: number;
  cue: string;
}

export interface CustomExercise extends Exercise {
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}

export interface Workout {
  id: string;
  /** ISO timestamp. */
  startedAt: string;
  name: string;
  notes: string | null;
  /** null = in progress. */
  durationS: number | null;
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}

/** Hevy-style set classification. `warmup` is excluded from volume/e1RM/PRs. */
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  /** null for bodyweight/duration sets. */
  weightKg: number | null;
  /** null for duration sets. */
  reps: number | null;
  /** null for rep sets. */
  durationS: number | null;
  rpe: number | null;
  /** `isWarmup` is kept in sync with `setType === 'warmup'` for back-compat. */
  isWarmup: boolean;
  setType: SetType;
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}

export interface RoutineItem {
  exerciseId: string;
  sets: number;
  reps: number;
  weightKg: number | null;
}

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}
