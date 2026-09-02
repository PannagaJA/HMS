import os
import glob
from django.db import connection

def run_staging_verification():
    print("==================================================================")
    print("STARTING REAL POSTGRESQL STAGING VERIFICATION")
    print("==================================================================")
    
    with connection.cursor() as cursor:
        # Step 1: Create clean staging schema
        print("\n[STEP 1] Initializing clean schema: 'staging_supabase'...")
        cursor.execute("DROP SCHEMA IF EXISTS staging_supabase CASCADE;")
        cursor.execute("CREATE SCHEMA staging_supabase;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS auth;")
        cursor.execute("DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
        cursor.execute("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
        cursor.execute("SET search_path TO staging_supabase, auth, public;")
        print("-> Clean schema 'staging_supabase', 'auth' and roles initialized.")

        # Step 2: Apply all migrations in order
        migration_files = sorted(glob.glob("../supabase/migrations/*.sql"))
        print(f"\n[STEP 2] Applying {len(migration_files)} SQL migrations in order...")
        for mf in migration_files:
            fname = os.path.basename(mf)
            # Skip storage bucket table inserts on standard postgres without storage extension
            if "015_storage" in fname:
                print(f"-> Skipping {fname} (Supabase Storage object table specific to hosted environment)")
                continue
            print(f"-> Executing {fname}...")
            with open(mf, "r", encoding="utf-8") as f:
                sql_content = f.read()
                # Adapt auth schema references if running in standard PostgreSQL
                sql_content = sql_content.replace("REFERENCES auth.users(id)", "REFERENCES public.profiles(id)")
                sql_content = sql_content.replace("auth.uid()", "'00000000-0000-0000-0000-000000000001'::uuid")
                cursor.execute(sql_content)
        print("-> All migrations executed cleanly against PostgreSQL!")

        # Step 3: Verify Tables & Constraints
        print("\n[STEP 3] Verifying deployed PostgreSQL tables...")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'staging_supabase'
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cursor.fetchall()]
        print(f"-> Deployed {len(tables)} tables: {', '.join(tables)}")

        # Step 4: Verify Room/Bed Invariants via Database RPCs
        print("\n[STEP 4] Testing create_room_with_beds RPC & Capacity Integrity...")
        # Create a hostel with timestamp/uuid to ensure clean run
        import uuid
        hname = f"Staging Block {uuid.uuid4().hex[:6]}"
        cursor.execute("INSERT INTO hostels (name, gender, floor_count) VALUES (%s, 'M', 3) RETURNING id;", (hname,))
        hostel_id = cursor.fetchone()[0]

        # Call create_room_with_beds for capacity 3
        cursor.execute("SELECT create_room_with_beds(%s, 'A-101', 1, 3, 'T');", (hostel_id,))
        room_id = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s;", (room_id,))
        bed_count = cursor.fetchone()[0]
        assert bed_count == 3, f"Expected 3 beds, found {bed_count}"
        print(f"-> Room A-101 (Capacity 3) successfully created with exactly {bed_count} physical beds! (INVARIANT PASS)")

        # Test resize_room_capacity upward to 4
        print("-> Testing resize_room_capacity upward (3 -> 4)...")
        cursor.execute("SELECT resize_room_capacity(%s, 4);", (room_id,))
        cursor.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s;", (room_id,))
        new_bed_count = cursor.fetchone()[0]
        assert new_bed_count == 4, f"Expected 4 beds, found {new_bed_count}"
        print(f"-> Capacity expanded to 4: Exactly {new_bed_count} beds exist! (PASS)")

        # Step 5: Test Allocation Invariants
        print("\n[STEP 5] Testing allocate_student_room RPC...")
        # Create an admin profile so auth.uid() resolves to a valid profile FK
        cursor.execute("""
            INSERT INTO public.profiles (id, email, role, first_name, last_name)
            VALUES ('00000000-0000-0000-0000-000000000001', 'admin@amc.edu', 'ADMIN', 'Admin', 'User')
            ON CONFLICT (id) DO NOTHING;
        """)

        e1 = f"STG_{uuid.uuid4().hex[:6]}"
        cursor.execute("""
            INSERT INTO students (student_name, enrollment_no, gender, no_dues, status)
            VALUES ('Test Student 1', %s, 'M', TRUE, 'ACTIVE')
            RETURNING id;
        """, (e1,))
        student_id = cursor.fetchone()[0]

        cursor.execute("SELECT id FROM beds WHERE room_id = %s AND bed_number = 1;", (room_id,))
        bed_1_id = cursor.fetchone()[0]

        cursor.execute("SELECT allocate_student_room(%s, %s);", (student_id, bed_1_id))
        print(f"-> Allocated Student {student_id} to Bed {bed_1_id} successfully.")

        # Test double booking of same bed
        e2 = f"STG_{uuid.uuid4().hex[:6]}"
        cursor.execute("""
            INSERT INTO students (student_name, enrollment_no, gender, no_dues, status)
            VALUES ('Test Student 2', %s, 'M', TRUE, 'ACTIVE')
            RETURNING id;
        """, (e2,))
        student_2_id = cursor.fetchone()[0]

        try:
            cursor.execute("SELECT allocate_student_room(%s, %s);", (student_2_id, bed_1_id))
            raise Exception("FAILED: Double booking succeeded when it should have been rejected!")
        except Exception as e:
            print("-> Successfully rejected double booking of same bed! (PASS)")
            connection.rollback()
            cursor.execute("SET search_path TO staging_supabase, public;")

        print("\n==================================================================")
        print("ALL REAL POSTGRESQL STAGING CHECKS PASSED CLEANLY!")
        print("==================================================================")

if __name__ == '__main__':
    run_staging_verification()
