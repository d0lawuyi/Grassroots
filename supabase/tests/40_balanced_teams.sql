-- 40_balanced_teams.sql: migration 005 (skill ratings and game teams)

insert into public.games (game_id, title, park_id)
  select '40000000-0000-0000-0000-000000000001', 'Thursday 7v7', park_id from public.parks where name = 'Legacy Park';
insert into public.game_teams (game_id, player_id, team) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1),
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 2);

-- Players set their own level, 1 to 5
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.users set skill_rating = 4 where user_id = '00000000-0000-0000-0000-00000000000a';
select t_check('A set their level', (select skill_rating = 4 from public.users where user_id = '00000000-0000-0000-0000-00000000000a'));
select t_expect_error('level above 5', $q$update public.users set skill_rating = 6 where user_id = '00000000-0000-0000-0000-00000000000a'$q$, 'users_skill_rating_range');
select t_expect_error('level 0', $q$update public.users set skill_rating = 0 where user_id = '00000000-0000-0000-0000-00000000000a'$q$, 'users_skill_rating_range');
update public.users set skill_rating = 5 where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
select t_check('A cannot set B''s level', (select skill_rating is null from public.users where user_id = '00000000-0000-0000-0000-00000000000b'));

-- Everyone signed in sees the teams; nobody in the app can change them
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_check('B sees both team rows', (select count(*) = 2 from public.game_teams));
select t_expect_error('B moves themselves to team 1', $q$update public.game_teams set team = 1$q$, 'permission denied');
select t_expect_error('B adds a team row', $q$insert into public.game_teams (game_id, player_id, team) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c',1)$q$, 'permission denied');
select t_expect_error('B deletes the teams', $q$delete from public.game_teams$q$, 'permission denied');
reset role;

set role anon; set request.jwt.claim.sub = '';
select t_expect_error('signed-out caller reads teams', 'select * from public.game_teams', 'permission denied');
reset role;

-- Deleting the game removes its teams
delete from public.games where game_id = '40000000-0000-0000-0000-000000000001';
select t_check('teams go with the game', (select count(*) = 0 from public.game_teams));
