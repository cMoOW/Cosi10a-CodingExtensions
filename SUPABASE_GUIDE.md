The current RLS (Row Level Security) policies allow:
- ✅ Anyone can create tickets (students)
- ✅ Anyone can read tickets (for dashboard)
- ❌ Only service role can update/delete (for security)
This means:
- The VS Code extension can create tickets (no auth needed)
- React dashboard can read tickets (no auth needed)
- Updates must go through Edge Functions or admin panel

**Next steps to consider:
- Add authentication for students
- Restrict ticket reading to authenticated TAs only

## Next Steps
1.    Schema is set up
2. ⏭ Update VS Code extension to create tickets (instead of sending emails)
3. ⏭ Build React dashboard to display tickets
4. ⏭(Optional) Add Edge Function for email notifications


## Troubleshooting
**Common Errors: "relation already exists"**
- The table already exists. You can either:
  - Delete it first: `DROP TABLE tickets CASCADE;`
  - Or just use `CREATE TABLE IF NOT EXISTS` (already in schema)

## Schema Modifications
How to add/modify columns later:

```sql
-- Add a new column
ALTER TABLE tickets ADD COLUMN new_field TEXT;
-- Modify an existing column
ALTER TABLE tickets ALTER COLUMN message TYPE VARCHAR(1000);
-- Remove a column (be careful!)
ALTER TABLE tickets DROP COLUMN column_name;
```

