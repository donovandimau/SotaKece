-- Synthetic local fixture only; run with node tests/run-coins-db.cjs.
-- Ana: wallet FJ$20 active. Bo: wallet dormant, FJ$0. Cy: wallet FJ$5 active. Nobody is friends.
BEGIN;
CREATE FUNCTION pg_temp.ok(p_value boolean,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF p_value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',p_label; END IF;
 RETURN 'PASS '||p_label;
END; $$;
CREATE FUNCTION pg_temp.fails(p_sql text,p_code text,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_code THEN RAISE EXCEPTION 'FAIL %: expected %, got % (%)',p_label,p_code,SQLSTATE,SQLERRM; END IF;
  RETURN 'PASS '||p_label;
 END;
 RAISE EXCEPTION 'FAIL %: expected error %',p_label,p_code;
END; $$;
CREATE FUNCTION pg_temp.as_member(p_who text) RETURNS void LANGUAGE sql AS $$
 SELECT set_config('request.jwt.claim.sub',
  CASE p_who WHEN 'ana' THEN '11111111-1111-1111-1111-111111111111'
             WHEN 'bo'  THEN '22222222-2222-2222-2222-222222222222'
             WHEN 'cy'  THEN '33333333-3333-3333-3333-333333333333' ELSE '' END,true);
$$;

-- nothing for anon
SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_coins()$$,'42501','anon cannot read coins');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(1,1,null)$$,'42501','anon cannot tip');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.coin_accounts$$,'42501','anon cannot read accounts');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.coin_settings$$,'42501','anon cannot read settings');
RESET ROLE;

-- a member starts at zero and sees the packs and the switches
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_coins()->>'balance')='0' AND (public.bv_coins()->>'earned')='0','a new member has an empty coin account');
SELECT pg_temp.ok((public.bv_coins()->>'buy_on')='false' AND (public.bv_coins()->>'payout_on')='false' AND (public.bv_coins()->>'tips_on')='true','buying and payouts start switched off');
SELECT pg_temp.ok(jsonb_array_length(public.bv_coins()->'bundles')=4 AND (public.bv_coins()->'bundles'->1->>'id')='tanoa','four packs are on sale, in order');
SELECT pg_temp.ok((public.bv_coins()->>'coin_sene')='10' AND (public.bv_coins()->>'fee_bps')='3000','the rate and the fee are published to the app');
SELECT pg_temp.ok((public.bv_talanoa_post('ana''s post')->>'id')='1','post 1 exists');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((public.bv_talanoa_post('bo''s post')->>'id')='2','post 2 exists');
SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,5,null)$$,'P0001','no coins means no tip (NOT_ENOUGH_COINS)');
SELECT pg_temp.fails($$SELECT public.bv_coins_buy('tanoa','x')$$,'P0001','buying is off until the owner switches it on (COINS_BUY_OFF)');

-- the owner switches buying on
RESET ROLE; UPDATE bulavata.coin_settings SET buy_on=true; SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_coins_buy('tanoa','x')->>'status')='settled','a pack is bought from the wallet');
SELECT pg_temp.ok((public.bv_coins()->>'balance')='110','100 coins plus the 10 bonus arrive');
SELECT pg_temp.ok((public.bv_coins_buy('tanoa','x')->>'status')='already_done','the same purchase twice is one purchase');
SELECT pg_temp.ok((public.bv_coins()->>'balance')='110','...and does not add coins twice');
RESET ROLE;
SELECT pg_temp.ok((SELECT balance_minor FROM bulavata.wallets WHERE owner='11111111-1111-1111-1111-111111111111')=1000,'the wallet paid FJ$10.00 once');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.transactions WHERE kind='coin_buy' AND direction='debit' AND amount_minor=1000 AND reference='coins:buy:x' AND status='settled')=1,'the wallet ledger holds one settled coin_buy leg');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_ledger WHERE owner='11111111-1111-1111-1111-111111111111' AND kind='buy' AND delta=110 AND reference='coins:buy:x')=1,'the coin ledger holds the matching buy leg');
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coins_buy('vanua',null)$$,'P0001','a pack the wallet cannot afford is refused (INSUFFICIENT_FUNDS)');
SELECT pg_temp.fails($$SELECT public.bv_coins_buy('nope',null)$$,'P0001','an unknown pack is refused (NO_SUCH_BUNDLE)');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.fails($$SELECT public.bv_coins_buy('bilo',null)$$,'P0001','a dormant wallet cannot buy (WALLET_DORMANT)');
SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((public.bv_coins_buy('bilo','cy1')->>'balance')='50','Cy buys the small pack with the last FJ$5');

-- tipping: giver pays, Sota Kece keeps the fee, the author earns the rest
SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((SELECT (r->>'balance')='100' AND (r->>'net')='7' AND (r->>'tip_count')='1' AND (r->>'tip_coins')='10' AND (r->>'tipped_today')='10'
  FROM public.bv_coin_tip(2,10,'  vinaka <b>  ') r),'a 10-coin tip: 7 to the author, 3 to Sota Kece, the post counts it');
RESET ROLE;
SELECT pg_temp.ok((SELECT earned FROM bulavata.coin_accounts WHERE owner='22222222-2222-2222-2222-222222222222')=7,'the author''s earned pile grows by the net');
SELECT pg_temp.ok((SELECT platform_fees FROM bulavata.coin_settings)=3,'the fee is counted for Sota Kece');
SELECT pg_temp.ok((SELECT count(DISTINCT group_id) FROM bulavata.coin_ledger WHERE kind IN ('tip_out','tip_in','fee') AND post_id=2)=1,'the three legs share one group');
SELECT pg_temp.ok((SELECT sum(delta) FROM bulavata.coin_ledger WHERE post_id=2)=0,'the legs of a tip sum to zero');
SELECT pg_temp.ok((SELECT note FROM bulavata.coin_tips WHERE post_id=2)='vinaka <b>','the note is trimmed and kept as plain text');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.notifications WHERE recipient='22222222-2222-2222-2222-222222222222' AND actor='11111111-1111-1111-1111-111111111111' AND kind='tip' AND target_kind='post' AND target_id=2 AND snippet='10|vinaka <b>')=1,'the author is told in Activity with the amount and the note');
SET ROLE authenticated; SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((SELECT x->>'tip_coins' FROM jsonb_array_elements(public.bv_talanoa_feed('latest')) x WHERE (x->>'id')='2')='10','the wall card carries the tip total');
SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(1,1,null)$$,'P0001','nobody tips their own post (SELF_TIP)');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(999,1,null)$$,'P0001','a missing post is GONE');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,0,null)$$,'P0001','zero coins is BAD_AMOUNT');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,501,null)$$,'P0001','over the single-tip maximum is BAD_AMOUNT');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,200,null)$$,'P0001','more than the balance is NOT_ENOUGH_COINS');
RESET ROLE; UPDATE bulavata.coin_settings SET daily_tip_cap=15; SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,6,null)$$,'P0001','the daily cap holds (DAILY_CAP)');
SELECT pg_temp.ok((public.bv_coin_tip(2,5,null)->>'tipped_today')='15','a tip inside the cap goes through');
RESET ROLE; UPDATE bulavata.coin_settings SET daily_tip_cap=500, tips_on=false; SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coin_tip(2,1,null)$$,'P0001','the owner can switch tipping off (TIPS_OFF)');
RESET ROLE; UPDATE bulavata.coin_settings SET tips_on=true, fee_bps=0; SET ROLE authenticated; SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((public.bv_coin_tip(2,1,null)->>'net')='1','with the fee at zero the author gets every coin');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_ledger WHERE kind='fee' AND counterparty='33333333-3333-3333-3333-333333333333')=0,'no empty fee leg is written');
UPDATE bulavata.coin_settings SET fee_bps=3000;
SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok(jsonb_array_length(public.bv_coin_tips_for(2))=3 AND (public.bv_coin_tips_for(2)->0->>'handle')='cy','the author sees who tipped, newest first');
SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_coin_tips_for(2)$$,'42501','anon sees no tippers');
RESET ROLE;

-- payout: earned coins become wallet money, once the owner switches it on
SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((public.bv_coins()->>'earned')='12','Bo has earned 7 + 4 + 1 coins');
SELECT pg_temp.fails($$SELECT public.bv_coins_payout(10)$$,'P0001','payouts are off until the owner switches them on (PAYOUT_OFF)');
RESET ROLE; UPDATE bulavata.coin_settings SET payout_on=true; SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.fails($$SELECT public.bv_coins_payout(10)$$,'P0001','below the minimum is refused (BELOW_MINIMUM)');
RESET ROLE; UPDATE bulavata.coin_settings SET payout_min_coins=5; SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.fails($$SELECT public.bv_coins_payout(100)$$,'P0001','more than earned is refused (NOT_ENOUGH_EARNED)');
SELECT pg_temp.ok((SELECT (r->>'status')='settled' AND (r->>'minor')='100' AND (r->>'earned')='2' AND (r->>'wallet_minor')='100' FROM public.bv_coins_payout(10) r),'10 coins become FJ$1.00 in the wallet');
RESET ROLE;
SELECT pg_temp.ok((SELECT status FROM bulavata.wallets WHERE owner='22222222-2222-2222-2222-222222222222')='active','a dormant wallet wakes up when coins land in it');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.transactions t JOIN bulavata.coin_ledger l ON l.reference=t.reference WHERE t.kind='coin_payout' AND t.direction='credit' AND t.amount_minor=100 AND l.kind='payout' AND l.delta=-10)=1,'the wallet leg and the coin leg carry the same reference');
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_coins_payout(5)$$,'P0001','a member with nothing earned cannot pay out (NOT_ENOUGH_EARNED)');
RESET ROLE;

-- the books balance
SELECT pg_temp.ok((SELECT bool_and(a.balance = coalesce((SELECT sum(delta) FROM bulavata.coin_ledger l WHERE l.owner=a.owner AND l.kind IN ('buy','tip_out','adjust')),0)) FROM bulavata.coin_accounts a),'every balance equals its ledger');
SELECT pg_temp.ok((SELECT bool_and(a.earned = coalesce((SELECT sum(delta) FROM bulavata.coin_ledger l WHERE l.owner=a.owner AND l.kind IN ('tip_in','payout')),0)) FROM bulavata.coin_accounts a),'every earned pile equals its ledger');
SELECT pg_temp.ok((SELECT platform_fees FROM bulavata.coin_settings)=(SELECT coalesce(sum(delta),0) FROM bulavata.coin_ledger WHERE owner IS NULL),'Sota Kece''s fees equal the fee legs');
SELECT pg_temp.ok((SELECT coalesce(sum(delta),0) FROM bulavata.coin_ledger WHERE kind='buy')+(SELECT coalesce(sum(delta),0) FROM bulavata.coin_ledger WHERE kind='payout')
  = (SELECT sum(balance)+sum(earned) FROM bulavata.coin_accounts)+(SELECT platform_fees FROM bulavata.coin_settings),'coins minted minus coins paid out equals coins held plus fees');

-- members see only their own rows; nobody writes a table directly
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_accounts)=1 AND (SELECT count(*) FROM bulavata.coin_ledger WHERE owner<>'11111111-1111-1111-1111-111111111111')=0,'a member sees only their own account and ledger');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_tips)=2,'a member sees the tips they gave');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_tips)=3,'an author sees the tips they received');
SELECT pg_temp.fails($$UPDATE bulavata.coin_accounts SET balance=9999$$,'42501','balances cannot be edited directly');
SELECT pg_temp.fails($$INSERT INTO bulavata.coin_ledger(owner,kind,delta,group_id) VALUES ('22222222-2222-2222-2222-222222222222','adjust',5,gen_random_uuid())$$,'42501','the ledger cannot be written directly');
SELECT pg_temp.fails($$UPDATE bulavata.coin_settings SET buy_on=false$$,'42501','members cannot flip the switches');
RESET ROLE;

-- removing a post keeps every balance and the ledger; only the tip rows go
SET ROLE authenticated; SELECT pg_temp.as_member('bo'); SELECT public.bv_talanoa_delete(2); RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_tips WHERE post_id=2)=0,'tips on a removed post are gone');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.coin_ledger WHERE post_id IS NULL AND kind IN ('tip_out','tip_in','fee'))=8,'the ledger keeps the legs, without the post');
SELECT pg_temp.ok((SELECT earned FROM bulavata.coin_accounts WHERE owner='22222222-2222-2222-2222-222222222222')=2,'earned coins survive the post');
SELECT 'PASS suite completed';
ROLLBACK;
