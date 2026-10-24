DROP INDEX "inbound_messages_message_id_key";--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_user_message_id_key" ON "inbound_messages" USING btree ("user_id","message_id");