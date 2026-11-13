-- Star sign on a pet, for when the birthday is not known (set by the zodiac quiz).
-- A birthday always wins: the app works the sign out from pets.birthday when there is one and
-- only falls back to this column when there is not. Safe to run more than once.
BEGIN;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS zodiac_sign text,
  ADD COLUMN IF NOT EXISTS zodiac_result_id uuid REFERENCES public.quiz_results(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_zodiac_sign_check' AND conrelid = 'public.pets'::regclass) THEN
    ALTER TABLE public.pets ADD CONSTRAINT pets_zodiac_sign_check CHECK (
      zodiac_sign IS NULL OR zodiac_sign IN (
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.pets.zodiac_sign IS 'Star sign from the zodiac quiz; used only when birthday is empty';
COMMENT ON COLUMN public.pets.zodiac_result_id IS 'The quiz result that set zodiac_sign';

COMMIT;

-- Rollback (run manually):
-- ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_zodiac_sign_check,
--   DROP COLUMN IF EXISTS zodiac_result_id, DROP COLUMN IF EXISTS zodiac_sign;
