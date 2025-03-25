import { createClient } from '@supabase/supabase-js';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    const { question } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get database schema
    const dbSchema = await getDatabaseSchema();

    // Get SQL query from OpenAI
    const sqlQuery = await generateSQLQuery(question, dbSchema);
    
    try {
      // Execute the SQL query
      const queryResult = await executeQuery(sqlQuery);
      
      // Generate streaming natural language answer
      const stream = await streamingAnswer(question, sqlQuery, queryResult);
      
      // Return a streaming response with metadata in the header
      const response = stream.toDataStreamResponse();
      response.headers.set('X-SQL-Query', sqlQuery);
      
      return response;
    } catch (sqlError) {
      console.error('SQL execution error:', sqlError);
      
      // If SQL execution fails, generate a response about the error
      const errorResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You explain SQL query errors in a helpful, user-friendly way." },
          { role: "user", content: `The following SQL query failed: "${sqlQuery}". The error was: "${sqlError.message}". Please explain what might be wrong in a friendly way.` }
        ],
        stream: true,
      });
      
      const errorStream = streamText(errorResponse);
      const response = errorStream.toDataStreamResponse();
      response.headers.set('X-SQL-Query', sqlQuery);
      response.headers.set('X-SQL-Error', 'true');
      
      return response;
    }
  } catch (error) {
    console.error('Error processing question:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your question',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get the database schema information
async function getDatabaseSchema() {
  // This function collects table and column information from your database
  // You could make this dynamic, but for simplicity, we'll return a static schema description
  
  return `
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

View: personal_bests - Contains all runs where is_personal_best is TRUE
`;
}

// Generate SQL from a natural language question
async function generateSQLQuery(question, dbSchema) {
  const prompt = `
Given the following database schema for a speedrun tracking application:

${dbSchema}

Convert the following natural language question to a SQL query that will run against a PostgreSQL database:

"${question}"

Return ONLY the valid SQL query, nothing else.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // You can change this to gpt-4 if needed
    messages: [
      { role: "system", content: "You are a helpful assistant that translates natural language questions to SQL queries. Return ONLY the SQL query, no explanations or markdown." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2, // Lower temperature for more predictable SQL
  });

  let sql = response.choices[0].message.content.trim();
  
  // Strip any markdown code block formatting if present
  if (sql.startsWith("```") && sql.endsWith("```")) {
    sql = sql.slice(3, -3).trim();
    
    // Also remove language identifier if present (e.g. ```sql)
    const firstLineBreak = sql.indexOf('\n');
    if (firstLineBreak !== -1 && !sql.substring(0, firstLineBreak).includes(' ')) {
      sql = sql.substring(firstLineBreak).trim();
    }
  }
  
  return sql;
}

// Execute the SQL query against Supabase
async function executeQuery(sqlQuery) {
  // Add a safety limit
  if (!sqlQuery.toLowerCase().includes("limit") && 
      (sqlQuery.toLowerCase().includes("select") && !sqlQuery.toLowerCase().includes("count("))) {
    sqlQuery += " LIMIT 100";
  }

  const { data, error } = await supabase.rpc('run_sql_query', {
    query_text: sqlQuery
  });

  if (error) {
    throw new Error(`Error executing SQL query: ${error.message}`);
  }

  return data || [];
}

// Generate a streaming natural language answer based on the query results
async function streamingAnswer(question, sqlQuery, queryResult) {
  const resultJson = JSON.stringify(queryResult, null, 2);
  
  const prompt = `
Given the following:

Original question: "${question}"

SQL query that was executed:
${sqlQuery}

Query results:
${resultJson}

Please provide a natural language answer to the original question based on the SQL query results. 
If there are no results, mention that no data was found matching the criteria.
Format important information like times, dates, and numeric values clearly.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that provides clear, concise answers based on database query results." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    stream: true,
  });

  // Create a stream from the OpenAI response
  return streamText(response);
}