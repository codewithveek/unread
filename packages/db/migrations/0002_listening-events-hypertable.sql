-- Tiger Cloud ships TimescaleDB. Plain Postgres (local dev without the
-- extension) keeps listening_events as an ordinary table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    PERFORM create_hypertable('listening_events', by_range('occurred_at', INTERVAL '7 days'), if_not_exists => TRUE);
  END IF;
END
$$;
