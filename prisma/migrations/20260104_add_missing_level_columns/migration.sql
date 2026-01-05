-- Add level column to Clan table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Clan' AND column_name = 'level'
    ) THEN
        ALTER TABLE "Clan" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add level column to Community table if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Community' AND column_name = 'level'
    ) THEN
        ALTER TABLE "Community" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;
