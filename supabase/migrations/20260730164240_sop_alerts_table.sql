-- Tabel pelacakan alert SOP monitoring
CREATE TABLE sop_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkpoint_id UUID REFERENCES checkpoints(id) ON DELETE CASCADE NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    first_alert_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sop_alerts_checkpoint ON sop_alerts(checkpoint_id);
CREATE INDEX idx_sop_alerts_site ON sop_alerts(site_id);
CREATE INDEX idx_sop_alerts_escalated ON sop_alerts(escalated);

-- Enable RLS
ALTER TABLE sop_alerts ENABLE ROW LEVEL SECURITY;

-- Admin & supervisor bisa baca
CREATE POLICY "Admin full access sop_alerts" ON sop_alerts FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Supervisor read sop_alerts in own site" ON sop_alerts FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
    AND site_id = (SELECT site_id FROM users WHERE auth_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_alerts TO authenticated, service_role;
