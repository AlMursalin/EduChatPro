-- EduChatPro v1.4.1: group call toggle + group polls

create or replace function private.ecp_guard_group_call_create()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  r text;
  enabled boolean;
begin
  if new.group_id is null or auth.uid() is null then return new; end if;
  if new.host_id is distinct from auth.uid() then
    raise exception 'Meeting host does not match signed-in user.' using errcode='42501';
  end if;

  r := private.ecp_account_role(auth.uid());
  if r in ('super_admin','assistant_admin') then return new; end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id=new.group_id and gm.user_id=auth.uid()
  ) then
    raise exception 'You are not a member of this group.' using errcode='42501';
  end if;

  select allow_member_messaging into enabled from public.groups where id=new.group_id;
  if coalesce(enabled,false) is not true then
    raise exception 'Texting or calling is not allowed in this group.' using errcode='42501';
  end if;
  return new;
end;
$$;

-- Existing group_polls/group_poll_votes tables are used.
-- Members can vote even when allow_member_messaging=false because poll RLS is group-membership based.
