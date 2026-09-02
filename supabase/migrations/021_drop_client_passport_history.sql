-- Passport history is dead weight in MVP: nothing acts on it, and clients
-- already carry their current passport on the row. Drop the trigger, the
-- archiver function, and the table.

drop trigger if exists clients_archive_passport on clients;
drop function if exists archive_previous_passport();
drop table if exists client_passports;
