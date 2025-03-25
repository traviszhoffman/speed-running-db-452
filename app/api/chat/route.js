import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req) {
  const { messages } = await req.json();
  
  // Create a system message with the database schema information
  const schemaInfo = `
  Database Schema:
  
  Table: games
  - game_id (INTEGER, Primary Key): Unique identifier for each game
  - title (TEXT): Name of the game
  - platform (TEXT): Platform the game is on (PC, PS5, Xbox, etc.)
  - genre (TEXT): Primary genre of the game
  - release_date (DATE): When the game was released
  
  Table: categories
  - category_id (INTEGER, Primary Key): Unique identifier for each speedrun category
  - game_id (INTEGER, Foreign Key to games.game_id): References the Games table
  - name (TEXT): Name of the category (Any%, 100%, Glitchless, etc.)
  - description (TEXT): Description of category requirements/rules
  - world_record_time (NUMERIC): Current world record time in seconds
  - world_record_holder (TEXT): Name of the person who holds the world record
  
  Table: runs
  - run_id (INTEGER, Primary Key): Unique identifier for each speedrun attempt
  - game_id (INTEGER, Foreign Key to games.game_id): References the Games table
  - category_id (INTEGER, Foreign Key to categories.category_id): References the Categories table
  - date (DATE): Date when the run was performed
  - completion_time (NUMERIC): Time taken to complete the run in seconds
  - is_personal_best (BOOLEAN): Whether this is a personal best time
  - notes (TEXT): Any notes about the run (strategies used, mistakes made)
  
  View: personal_bests
  - Contains all runs where is_personal_best is TRUE
  `;
  
  // Construct the prompt
  const systemMessage = {
    role: 'system',
    content: `You are an SQL expert that converts natural language queries into SQL statements for a speedrun tracking database. 
    ${schemaInfo}
    
    Generate ONLY the SQL statement without any explanations or markdown formatting.
    Ensure the SQL is valid for PostgreSQL (used by Supabase).`
  };
  
  // Combine system message with user messages
  const promptMessages = [systemMessage, ...messages];
  
  // Generate SQL using OpenAI
  const result = streamText({
    model: openai('gpt-4o'),
    messages: promptMessages,
  });
  
  return result.toDataStreamResponse();
}