-- EduChatPro v1.5.2 Poll permission rules.
-- Admin/Super Admin: create + vote regardless of member messaging state.
-- Normal member + messaging ON: create + vote.
-- Normal member + messaging OFF: cannot create, can still vote.

drop policy if exists group_polls_create on public.group_polls;
create policy group_polls_create
on public.group_polls
for insert
to authenticated
with check (
  created_by = auth.uid()
  and in_group(group_id)
  and (
    exists (
      select 1
      from public.user_roles r
      where r.user_id = auth.uid()
        and r.role::text in ('super_admin','assistant_admin')
    )
    or exists (
      select 1
      from public.groups g
      where g.id = group_id
        and g.allow_member_messaging = true
    )
  )
);

-- Existing group_poll_votes policies intentionally remain based on group membership
-- and poll open/closed state, not on allow_member_messaging.
