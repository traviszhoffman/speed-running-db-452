// File: app/api/admin/reseed/route.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req) {
  try {
    // Check for authorization
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.RESEED_SECRET_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get request body to see if we should drop tables first
    const body = await req.json()
    const { dropTables = false } = body
    
    // Read the SQL files - adjust paths as needed for your project structure
    const setupSql = fs.readFileSync(path.join(process.cwd(), 'sql/setup.sql'), 'utf8')
    const seedDataSql = fs.readFileSync(path.join(process.cwd(), 'sql/seedData.sql'), 'utf8')
    
    let result
    
    if (dropTables) {
      // Drop tables if requested
      const dropTablesSql = `
        DROP TABLE IF EXISTS runs CASCADE;
        DROP TABLE IF EXISTS categories CASCADE;
        DROP TABLE IF EXISTS games CASCADE;
        DROP VIEW IF EXISTS personal_bests CASCADE;
      `
      // Note: You need to enable the 'pg_execute' extension in Supabase for rpc to work
      result = await supabase.rpc('pg_execute', { query: dropTablesSql })
      if (result.error) throw new Error(`Error dropping tables: ${result.error.message}`)
      console.log('Tables dropped successfully')
    }
    
    // Execute setup.sql to create tables and structure
    result = await supabase.rpc('pg_execute', { query: setupSql })
    if (result.error) throw new Error(`Error setting up tables: ${result.error.message}`)
    console.log('Tables created successfully')
    
    // Execute seedData.sql to insert initial data
    result = await supabase.rpc('pg_execute', { query: seedDataSql })
    if (result.error) throw new Error(`Error seeding data: ${result.error.message}`)
    console.log('Data seeded successfully')
    
    return Response.json({ 
      success: true, 
      message: 'Database reseeded successfully',
      details: {
        tablesDropped: dropTables,
        tablesCreated: true,
        dataSeeded: true
      }
    })
  } catch (error) {
    console.error('Error reseeding database:', error)
    return Response.json({ 
      success: false, 
      error: error.message 
    }, {
      status: 500
    })
  }
}