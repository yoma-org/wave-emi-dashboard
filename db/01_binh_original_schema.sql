create type ticket_status as enum (
  'AWAITING_EMPLOYEE_LIST', 'ASKED_CLIENT', 'PENDING_APPROVAL',
  'APPROVED', 'REJECTED', 'COMPLETED'
);

create type ticket_scenario as enum (
    'NORMAL', 'AMOUNT_MISMATCH', 'MISSING_APPROVAL'
)

create type ticket_risk_level as enum ('LOW', 'MEDIUM', 'HIGH');

create table tickets
(
    id                       UUID primary key           default uuid_generate_v4(),
    company                  varchar(100)      not null default 'Unknown Company',
    type                     varchar(20)       not null default 'SalaryToMA', -- consider an enum
    currency                 varchar(3)        not null default 'MMK',
    scenario                 ticket_scenario   not null default 'NORMAL',
    status                   ticket_status     not null default 'AWAITING_EMPLOYEE_LIST',
    risk_level               ticket_risk_level not null default 'LOW',

    amount_requested         numeric(18, 2)    not null default 0,
    amount_on_bank_slip      numeric(18, 2)    not null default 0,
    amount_on_document       numeric(18, 2)    not null default 0,
    has_mismatch             boolean           not null default false,

    approval_matrix_complete boolean           not null default false,
    required_approvals       text,
    email_approvals          text,

    remark                   text                       default '',
    transaction_id           text                       default '',
    depositor_name           text                       default '',

    created_at               timestamptz       not null default now(),
    updated_at               timestamptz       not null default now()
);

create table ticket_emails
(
    id               UUID primary key     default uuid_generate_v4(),
    ticket_id        UUID        not null references tickets (id) on delete cascade,

    source_email_id  text        not null,
    from_email       varchar(100)         default '',
    to_email         varchar(100)         default '',
    cc_emails        text                 default '',
    reply_to         text                 default '',
    email_date       timestamptz,
    message_id       text                 default '',
    thread_id        text                 default '',
    original_subject text                 default '',
    body_preview     text                 default '',
    email_body_full  text                 default '',

    -- ingestion metadata
    n8n_source       boolean     not null default true,
    n8n_parsed_at    timestamptz,

    created_at       timestamptz not null default now()
);

create table ticket_attachments
(
    id          UUID primary key      default uuid_generate_v4(),
    ticket_id   UUID         not null references tickets (id) on delete cascade,

    file_name   varchar(255) not null,
    mime_type   varchar(50),
    storage_url text, -- supabase storage path
    size_bytes  bigint,

    created_at  timestamptz  not null default now()
);

create table ticket_vision_results
(
    id                UUID primary key     default uuid_generate_v4(),
    ticket_id         UUID        not null references tickets (id) on delete cascade,
    attachment_id     UUID references ticket_attachments (id),

    vision_parsed     boolean     not null default false,
    vision_confidence numeric(5, 4)        default 0,
    vision_status     varchar(20)          default 'none',
    document_type     varchar(50)          default '',
    document_signers  jsonb                default '[]'::jsonb,

    created_at        timestamptz not null default now()
);

create table ticket_employee_extractions
(
    id                  UUID primary key     default uuid_generate_v4(),
    ticket_id           UUID        not null references tickets (id) on delete cascade,

    extracted_employees jsonb                default '[]'::jsonb,
    employee_count      int                  default 0,
    total_amount        numeric(18, 2)       default 0,
    confidence          numeric(5, 4)        default 0,
    status              varchar(50)          default 'none',
    amount_mismatch     boolean     not null default false,

    created_at          timestamptz not null default now()
);

