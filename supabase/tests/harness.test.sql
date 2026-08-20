begin;

select plan(2);

select has_extension('pgtap', 'pgTAP extension is installed');
select ok(true, 'pgTAP harness executes assertions');

select * from finish();

rollback;
