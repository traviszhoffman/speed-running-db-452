-- Create Games Table
CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    genre TEXT,
    release_date DATE
);

-- Create Categories Table
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    world_record_time NUMERIC(10, 3),  -- Stored in seconds with millisecond precision
    world_record_holder TEXT
);

-- Create Runs Table
CREATE TABLE runs (
    run_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completion_time NUMERIC(10, 3) NOT NULL,  -- Stored in seconds with millisecond precision
    is_personal_best BOOLEAN DEFAULT FALSE,
    notes TEXT
);

-- Create an index for faster queries on personal bests
CREATE INDEX idx_personal_best ON runs(game_id, category_id, is_personal_best);

-- Optional: Create a view for easy retrieval of personal bests
CREATE VIEW personal_bests AS
SELECT 
    r.run_id,
    g.title AS game_title,
    g.platform,
    c.name AS category_name,
    r.completion_time,
    r.date,
    r.notes,
    c.world_record_time,
    c.world_record_holder,
    (r.completion_time - c.world_record_time) AS time_difference
FROM 
    runs r
JOIN 
    games g ON r.game_id = g.game_id
JOIN 
    categories c ON r.category_id = c.category_id
WHERE 
    r.is_personal_best = TRUE;