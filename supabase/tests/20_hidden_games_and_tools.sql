-- 20_hidden_games_and_tools.sql: migrations 002 (hidden games) and 003 (pre-checks, Sideline opt-in)

insert into public.users (user_id, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner A'),
  ('00000000-0000-0000-0000-00000000000b', 'Owner B');
insert into public.games (game_id, title, park_id)
  select '20000000-0000-0000-0000-000000000001', 'Tuesday 5v5', park_id from public.parks where name = 'Legacy Park';

-- Hidden games: each player only sees and changes their own
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.hidden_games (game_id) values ('20000000-0000-0000-0000-000000000001');
select t_check('A hid a game', (select count(*) = 1 from public.hidden_games));
select t_expect_error('A hides a game for B', $q$insert into public.hidden_games (user_id, game_id) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001')$q$, 'row-level security');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_check('B cannot see A hidden games', (select count(*) = 0 from public.hidden_games));
reset role;
delete from public.games where game_id = '20000000-0000-0000-0000-000000000001';
select t_check('hidden rows go when the game is deleted', (select count(*) = 0 from public.hidden_games));

-- Pre-checks: admins read, owners don't
insert into public.venue_prechecks (submission_id, score, findings)
  values ('10000000-0000-0000-0000-000000000002', 75, '[{"check":"ownership","level":"flag","message":"x"}]');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t_check('owner cannot read pre-checks', (select count(*) = 0 from public.venue_prechecks));
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_check('admin reads pre-checks', (select count(*) = 1 from public.venue_prechecks));
reset role;
select t_expect_error('score must be 0-100', $q$update public.venue_prechecks set score = 140$q$, 'check constraint');

-- Sideline opt-in is off unless a player turns it on, and only they can turn it on
select t_check('opt-in defaults to off', (select bool_and(not sideline_feature) from public.users));
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.users set sideline_feature = true;
reset role;
select t_check('A opted in, B untouched', (select count(*) = 1 from public.users where sideline_feature));
