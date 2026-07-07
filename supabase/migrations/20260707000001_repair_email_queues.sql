-- Repair pgmq email queues left in a malformed state (missing msg_id column),
-- which makes pgmq.send() fail with: column "msg_id" does not exist.
-- Seen after branch resets / db pulls that recreate queue tables incorrectly.

DO $$
DECLARE q TEXT;
BEGIN
  FOREACH q IN ARRAY ARRAY[
    'auth_emails', 'transactional_emails', 'auth_emails_dlq', 'transactional_emails_dlq'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'pgmq'
        AND table_name = 'q_' || q
        AND column_name = 'msg_id'
    ) THEN
      BEGIN
        PERFORM pgmq.drop_queue(q);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      PERFORM pgmq.create(q);
    END IF;
  END LOOP;
END $$;

-- Harden the RPC wrappers: also self-heal when the queue table exists but is
-- malformed (undefined_column, SQLSTATE 42703), not only when it is missing.
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  BEGIN
    PERFORM pgmq.drop_queue(queue_name);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  BEGIN
    PERFORM pgmq.drop_queue(queue_name);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;
