-- Clinic time: historical Moroccan rules before 2026-09-20 01:00 UTC, UTC+0 afterwards.
select tests.assert_equal(private.clinic_local('2026-07-01 12:00+00'), timestamp '2026-07-01 13:00', 'summer 2026 was UTC+1');
select tests.assert_equal(private.clinic_local('2026-03-01 12:00+00'), timestamp '2026-03-01 12:00', 'Ramadan 2026 was UTC+0');
select tests.assert_equal(private.clinic_local('2026-09-20 00:59:59+00'), timestamp '2026-09-20 01:59:59', 'last second of UTC+1');
select tests.assert_equal(private.clinic_local('2026-09-20 01:00+00'), timestamp '2026-09-20 01:00', 'switch to UTC+0');
select tests.assert_equal(private.clinic_local('2027-07-01 12:00+00'), timestamp '2027-07-01 12:00', 'no more summer offset');
select tests.assert_equal(private.clinic_instant('2026-09-24 09:00'), timestamptz '2026-09-24 09:00+00', 'opening time after the switch');
select tests.assert_equal(private.clinic_instant('2026-07-01 09:00'), timestamptz '2026-07-01 08:00+00', 'opening time in summer 2026');
select tests.assert_equal(private.clinic_instant(private.clinic_local(now())), date_trunc('microseconds', now()), 'round trip');
