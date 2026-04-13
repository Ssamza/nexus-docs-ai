-- Resets today's message count for all users (useful during development/testing)
DELETE FROM "Message" WHERE "createdAt" >= NOW() - INTERVAL '24 hours';
