DO $$
DECLARE
    table_name TEXT;
    legacy_tables TEXT[] := ARRAY[
        'admins',
        'teams',
        'players',
        'matches',
        'match_innings',
        'match_squads',
        'match_teams',
        'team_players',
        'deliveries'
    ];
    is_legacy BOOLEAN;
    has_rows BOOLEAN;
    schema_name TEXT := current_schema();
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns AS columns
        WHERE columns.table_schema = schema_name
          AND (
              (columns.table_name = 'matches' AND columns.column_name = 'title')
              OR (columns.table_name = 'players' AND columns.column_name = 'full_name')
              OR (columns.table_name = 'deliveries' AND columns.column_name = 'is_legal_delivery')
              OR (columns.table_name = 'match_innings')
          )
    )
    INTO is_legacy;

    IF NOT is_legacy THEN
        RETURN;
    END IF;

    FOREACH table_name IN ARRAY legacy_tables LOOP
        IF to_regclass(format('%I.%I', schema_name, table_name)) IS NOT NULL THEN
            EXECUTE format(
                'SELECT EXISTS (SELECT 1 FROM %I.%I)',
                schema_name,
                table_name
            )
            INTO has_rows;

            IF has_rows THEN
                RAISE EXCEPTION
                    'Cannot replace legacy schema because %.% contains data; migrate or archive it first',
                    schema_name,
                    table_name;
            END IF;
        END IF;
    END LOOP;

    EXECUTE format('DROP TABLE IF EXISTS %I.deliveries', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.match_squads', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.match_innings', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.match_teams', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.team_players', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.matches', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.players', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.teams', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.admins', schema_name);
END;
$$;
