-- 30_calendar_feeds.sql: migration 004 (private calendar links)

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t_check('link is 64 hex characters', (select my_calendar_feed() ~ '^[a-f0-9]{64}$'));
select t_check('asking again returns the same link', (select my_calendar_feed() = my_calendar_feed()));
select t_check('owner sees only their own row', (select count(*) = 1 from public.calendar_feeds));
select t_expect_error('owner writes a token directly', $q$update public.calendar_feeds set token = 'guessable'$q$, 'permission denied');
select t_expect_error('owner inserts for someone else', $q$insert into public.calendar_feeds (owner_id) values ('00000000-0000-0000-0000-00000000000b')$q$, 'permission denied');
reset role;

-- Resetting gives a new link and the old one is gone
create temp table old_link as select token from public.calendar_feeds where owner_id = '00000000-0000-0000-0000-00000000000a';
grant select on old_link to authenticated;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t_check('reset makes a new link', (select reset_calendar_feed() <> (select token from old_link)));
reset role;
select t_check('old link no longer works', (select count(*) = 0 from public.calendar_feeds c join old_link o on o.token = c.token));

-- Another owner can't see A's link
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_check('B cannot see A link', (select count(*) = 0 from public.calendar_feeds where owner_id = '00000000-0000-0000-0000-00000000000a'));
reset role;

-- Signed out: no link
set role anon; set request.jwt.claim.sub = '';
select t_expect_error('signed-out caller', 'select my_calendar_feed()', 'permission denied');
reset role;
