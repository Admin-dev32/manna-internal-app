-- Añade permisos granulares de inventario para preparación operativa por evento.

create or replace function public.get_known_permissions()
returns text[]
language sql
stable
as $$
  select array[
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'tasks.manage',
    'tasks.assign',
    'tasks.update_status',
    'chat.view',
    'chat.send',
    'chat.manage',
    'notifications.view',
    'communication.view',
    'employees.view',
    'finance.view',
    'finance.manage_defaults',
    'finance.edit_quote_sheet',
    'finance.view_event_summary',
    'finance.invoices.view',
    'finance.invoices.manage',
    'finance.expenses.view',
    'finance.expenses.manage',
    'finance.expenses.approve',
    'inventory.view',
    'inventory.manage',
    'inventory.prepare',
    'settings.view',
    'audit.view',
    'admin.users.manage'
  ]::text[];
$$;

create or replace function public.get_role_permissions(target_role text)
returns text[]
language sql
stable
as $$
  select case target_role
    when 'owner' then public.get_known_permissions()
    when 'manager' then array[
      'dashboard.view',
      'crm.view',
      'quotes.view',
      'events.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view',
      'employees.view',
      'finance.view',
      'finance.edit_quote_sheet',
      'finance.view_event_summary',
      'finance.invoices.view',
      'finance.expenses.view',
      'inventory.view',
      'inventory.manage',
      'inventory.prepare'
    ]::text[]
    when 'empleado' then array[
      'dashboard.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view'
    ]::text[]
    else array[]::text[]
  end;
$$;
