-- 10_venue_marketplace.sql: owners, admins and the four checks (migration 001)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','owner.a@test.com'),
 ('00000000-0000-0000-0000-00000000000b','owner.b@test.com'),
 ('00000000-0000-0000-0000-00000000000c','admin@test.com');
insert into public.admins (user_id) select id from auth.users where email='admin@test.com';

-- ===== Owner A
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t_expect_error('insert as approved', $q$insert into venue_submissions (name,status) values ('X','approved')$q$, 'start as a draft');
insert into venue_submissions (submission_id, name, sports, latitude, longitude, hourly_rate, admin_note)
  values ('10000000-0000-0000-0000-000000000001','Central Green Field','{soccer,flag_football}',39.79,-86.15,40,'sneaky');
select t_check('admin_note stripped on insert', (select admin_note is null from venue_submissions where submission_id='10000000-0000-0000-0000-000000000001'));
select t_check('owner forced to self', (select owner_id = auth.uid() from venue_submissions limit 1));
select t_expect_error('submit without photos', $q$update venue_submissions set status='submitted' where submission_id='10000000-0000-0000-0000-000000000001'$q$, 'at least one photo');
update venue_submissions set photos='{https://x/p1.jpg}' where submission_id='10000000-0000-0000-0000-000000000001';
select t_expect_error('submit without proof', $q$update venue_submissions set status='submitted' where submission_id='10000000-0000-0000-0000-000000000001'$q$, 'proof');
select t_expect_error('owner sets admin note', $q$update venue_submissions set admin_note='ok' where submission_id='10000000-0000-0000-0000-000000000001'$q$, 'admins only');
select t_expect_error('owner self-approves', $q$update venue_submissions set status='approved' where submission_id='10000000-0000-0000-0000-000000000001'$q$, 'save a draft or submit');
update venue_submissions set proof_path='0000/permit.jpg', status='submitted' where submission_id='10000000-0000-0000-0000-000000000001';
select t_check('submitted_at set', (select submitted_at is not null from venue_submissions where submission_id='10000000-0000-0000-0000-000000000001'));
select t_expect_error('edit after submit', $q$update venue_submissions set name='Changed' where submission_id='10000000-0000-0000-0000-000000000001'$q$, 'no longer be edited');
select t_expect_error('owner opens queue', 'select admin_venue_queue()', 'Only Grassroots admins');
select t_expect_error('owner reviews', $q$select review_venue_submission('10000000-0000-0000-0000-000000000001','approve')$q$, 'Only Grassroots admins');
select t_check('is_admin false for owner', not is_admin());
select t_expect_error('owner marks park verified', $q$insert into parks (name, verification_status) values ('Fake','approved')$q$, '');
-- a second submission that will need changes
insert into venue_submissions (submission_id, name, sports, latitude, longitude, is_free, photos, proof_path, status)
  values ('10000000-0000-0000-0000-000000000002','Fall Creek Courts','{basketball}',39.82,-86.12,true,'{https://x/p2.jpg}','a/proof.jpg','submitted');
select t_check('free venue rate forced 0', (select hourly_rate = 0 from venue_submissions where submission_id='10000000-0000-0000-0000-000000000002'));
-- storage
insert into storage.objects (bucket_id, name) values ('venue-photos','00000000-0000-0000-0000-00000000000a/v/p1.jpg');
select t_expect_error('upload to other folder', $q$insert into storage.objects (bucket_id, name) values ('venue-photos','00000000-0000-0000-0000-00000000000b/v/p1.jpg')$q$, 'row-level security');
insert into storage.objects (bucket_id, name) values ('venue-proofs','00000000-0000-0000-0000-00000000000a/permit.jpg');
reset role;

-- ===== Owner B
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select t_check('B cannot see A submissions', (select count(*) = 0 from venue_submissions));
update venue_submissions set name='hijack';
select t_check('B cannot read A proof', (select count(*) = 0 from storage.objects where bucket_id='venue-proofs'));
reset role;
select t_check('hijack had no effect', (select count(*) = 0 from venue_submissions where name='hijack'));

-- ===== Admin C
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t_check('is_admin true', is_admin());
select t_check('queue has 2', jsonb_array_length(admin_venue_queue()) = 2);
select t_check('queue has owner email', admin_venue_queue()->0->>'owner_email' like 'owner.a%');
select t_check('admin reads proof', (select count(*) = 1 from storage.objects where bucket_id='venue-proofs'));
-- Admins can't skip the four checks by editing the row directly: the update changes nothing
update venue_submissions set status='approved' where submission_id='10000000-0000-0000-0000-000000000001';
select t_check('admin direct edit has no effect', (select status='submitted' from venue_submissions where submission_id='10000000-0000-0000-0000-000000000001'));
select t_expect_error('approve w/ 3 checks', $q$select review_venue_submission('10000000-0000-0000-0000-000000000001','approve',null,
  '{"ownership":{"result":"pass"},"location":{"result":"pass"},"pricing":{"result":"pass"}}')$q$, 'All four checks');
select t_expect_error('approve with a flag', $q$select review_venue_submission('10000000-0000-0000-0000-000000000001','approve',null,
  '{"ownership":{"result":"pass"},"location":{"result":"pass"},"pricing":{"result":"pass"},"legitimacy":{"result":"flag","note":"stock photo"}}')$q$, 'All four checks');
select t_expect_error('changes without note', $q$select review_venue_submission('10000000-0000-0000-0000-000000000002','request_changes','  ')$q$, 'Add a note');
select t_expect_error('bad check name', $q$select review_venue_submission('10000000-0000-0000-0000-000000000001','approve',null,'{"vibes":{"result":"pass"}}')$q$, 'check');
select review_venue_submission('10000000-0000-0000-0000-000000000001','approve','Looks good',
  '{"ownership":{"result":"pass"},"location":{"result":"pass"},"pricing":{"result":"pass"},"legitimacy":{"result":"pass","note":"photos match"}}') ->> 'status';
select review_venue_submission('10000000-0000-0000-0000-000000000002','request_changes','Please add a photo of the full court');
select t_expect_error('review twice', $q$select review_venue_submission('10000000-0000-0000-0000-000000000001','approve')$q$, 'not waiting for review');
reset role;

select t_check('park created verified+active', (select count(*) = 1 from parks where verification_status='approved' and status='active' and name='Central Green Field'));
select t_check('submission linked to park', (select park_id is not null and status='approved' from venue_submissions where submission_id='10000000-0000-0000-0000-000000000001'));
select t_check('legacy park untouched', (select verification_status is null from parks where name='Legacy Park'));

-- ===== Owner A fixes and resubmits #2
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t_check('A sees admin note', (select admin_note like 'Please add%' from venue_submissions where submission_id='10000000-0000-0000-0000-000000000002'));
update venue_submissions set photos = photos || '{https://x/p3.jpg}', status='submitted' where submission_id='10000000-0000-0000-0000-000000000002';
select t_check('resubmitted', (select status='submitted' from venue_submissions where submission_id='10000000-0000-0000-0000-000000000002'));
-- An owner can't un-verify (or otherwise change) a park directly: the update changes nothing
update parks set verification_status=null;
reset role;
select t_check('owner park edit has no effect', (select verification_status='approved' from parks where name='Central Green Field'));
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select review_venue_submission('10000000-0000-0000-0000-000000000002','reject','Not a real venue') ->> 'status';
reset role;
select t_check('rejected', (select status='rejected' from venue_submissions where submission_id='10000000-0000-0000-0000-000000000002'));
