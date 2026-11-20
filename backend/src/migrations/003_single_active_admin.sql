DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM admins
        WHERE is_active = TRUE
          AND role IN ('admin', 'super_admin')
    ) > 1 THEN
        RAISE EXCEPTION
            'Cannot enforce one active admin: deactivate extra admin accounts first';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS admins_one_active_admin_idx
    ON admins ((TRUE))
    WHERE is_active = TRUE
      AND role IN ('admin', 'super_admin');
