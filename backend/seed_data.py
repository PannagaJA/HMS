import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hms_project.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date
from apps.hms_admin.models import Hostel, HostelRoom, HostelCourse, HostelWarden, HostelCaretaker
from apps.student.models import HostelStudent
from apps.warden.models import HostelIssue, IssueUpdate
from apps.security.models import GatePassRequest, VisitorLog
from apps.mess.models import MealType, MenuItem, Menu, StudentMealSkip

User = get_user_model()

def seed():
    print("[+] Starting Seed Process for Modular HMS...")

    # 1. Create Users for all 4 Roles
    # Password for all is: password123
    admin_user, _ = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@hms.local',
            'first_name': 'Sarah',
            'last_name': 'Johnson',
            'role': 'ADMIN',
            'is_staff': True,
            'is_superuser': True,
            'phone': '+91 9876543210',
            'avatar_url': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
        }
    )
    admin_user.set_password('password123')
    admin_user.save()

    warden_user, _ = User.objects.get_or_create(
        username='warden',
        defaults={
            'email': 'warden@hms.local',
            'first_name': 'Dr. Robert',
            'last_name': 'Mukherjee',
            'role': 'WARDEN',
            'phone': '+91 9811223344',
            'avatar_url': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
        }
    )
    warden_user.set_password('password123')
    warden_user.save()

    security_user, _ = User.objects.get_or_create(
        username='security',
        defaults={
            'email': 'security@hms.local',
            'first_name': 'Rajesh',
            'last_name': 'Singh',
            'role': 'SECURITY',
            'phone': '+91 9899001122',
            'avatar_url': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
        }
    )
    security_user.set_password('password123')
    security_user.save()

    student_user, _ = User.objects.get_or_create(
        username='student',
        defaults={
            'email': 'student@hms.local',
            'first_name': 'Liam',
            'last_name': 'Evans',
            'role': 'STUDENT',
            'phone': '+91 9844556677',
            'avatar_url': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
        }
    )
    student_user.set_password('password123')
    student_user.save()

    roommate_user, _ = User.objects.get_or_create(
        username='sarah',
        defaults={
            'email': 'sarah.chen@hms.local',
            'first_name': 'Sarah',
            'last_name': 'Chen',
            'role': 'STUDENT',
            'phone': '+91 9877001122',
            'avatar_url': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
        }
    )
    roommate_user.set_password('password123')
    roommate_user.save()

    print("[OK] Created Users for Admin, Warden, Security, and Student")

    # 2. Create Staff Profiles
    warden_profile, _ = HostelWarden.objects.get_or_create(
        user=warden_user,
        defaults={
            'name': 'Dr. Robert Mukherjee',
            'email': 'warden@hms.local',
            'phone': '+91 9811223344',
            'designation': 'Chief Hostel Warden',
            'experience': 8,
            'address': 'Faculty Quarters B-12, Campus'
        }
    )

    caretaker_profile, _ = HostelCaretaker.objects.get_or_create(
        name='Suresh Sharma',
        defaults={
            'email': 'caretaker@hms.local',
            'phone': '+91 9822334455',
            'experience': 5,
            'address': 'Staff Block A-04'
        }
    )

    # 3. Create Courses & Hostels
    btech, _ = HostelCourse.objects.get_or_create(code='BTECH_CSE', defaults={'name': 'B.Tech Computer Science', 'room_type': 'D'})
    mtech, _ = HostelCourse.objects.get_or_create(code='MTECH_AI', defaults={'name': 'M.Tech Artificial Intelligence', 'room_type': 'S'})

    hostel_a, _ = Hostel.objects.get_or_create(
        name='Aryabhatta Boys Hostel (Block A)',
        defaults={
            'gender': 'M',
            'floor_count': 3,
            'warden': warden_profile,
            'caretaker': caretaker_profile,
            'address': 'North Campus, Tech Enclave'
        }
    )
    hostel_a.courses.add(btech, mtech)

    hostel_b, _ = Hostel.objects.get_or_create(
        name='Gargi Girls Hostel (Block B)',
        defaults={
            'gender': 'F',
            'floor_count': 3,
            'warden': warden_profile,
            'caretaker': caretaker_profile,
            'address': 'South Campus, Green Enclave'
        }
    )
    hostel_b.courses.add(btech)

    print("[OK] Created Hostels (Aryabhatta & Gargi)")

    # 4. Create Rooms
    room_101, _ = HostelRoom.objects.get_or_create(
        hostel=hostel_a, no='101',
        defaults={'name': 'Room 101', 'floor': 1, 'capacity': 2, 'room_type': 'D', 'vacant': False}
    )
    room_102, _ = HostelRoom.objects.get_or_create(
        hostel=hostel_a, no='102',
        defaults={'name': 'Room 102', 'floor': 1, 'capacity': 2, 'room_type': 'D', 'vacant': True}
    )
    room_103, _ = HostelRoom.objects.get_or_create(
        hostel=hostel_a, no='103',
        defaults={'name': 'Room 103', 'floor': 1, 'capacity': 1, 'room_type': 'S', 'vacant': True}
    )
    room_201, _ = HostelRoom.objects.get_or_create(
        hostel=hostel_a, no='201',
        defaults={'name': 'Room 201', 'floor': 2, 'capacity': 2, 'room_type': 'D', 'vacant': True}
    )

    # 5. Create Students & Allocate
    student_profile, _ = HostelStudent.objects.get_or_create(
        user=student_user,
        defaults={
            'student_name': 'Liam Evans',
            'father_name': 'David Evans',
            'enrollment_no': 'STU2026001',
            'course': btech,
            'gender': 'M',
            'room': room_101,
            'bed_number': '1',
            'room_allotted': True,
            'no_dues': True,
            'guardian_phone': '+91 9988776655',
            'emergency_contact': '+91 9988776655'
        }
    )

    roommate_profile, _ = HostelStudent.objects.get_or_create(
        user=roommate_user,
        defaults={
            'student_name': 'Sarah Chen',
            'father_name': 'Marcus Chen',
            'enrollment_no': 'STU2026002',
            'course': btech,
            'gender': 'F',
            'room': None,
            'room_allotted': False,
            'no_dues': True,
            'guardian_phone': '+91 9988112233',
            'emergency_contact': '+91 9988112233'
        }
    )

    # 6. Create Mess Meal Types & Menu
    br, _ = MealType.objects.get_or_create(name='BR', defaults={'description': 'Morning Breakfast', 'time_from': '07:30', 'time_to': '09:30'})
    ln, _ = MealType.objects.get_or_create(name='LN', defaults={'description': 'Afternoon Lunch', 'time_from': '12:30', 'time_to': '14:30'})
    sn, _ = MealType.objects.get_or_create(name='SN', defaults={'description': 'Evening Snacks', 'time_from': '17:00', 'time_to': '18:00'})
    dn, _ = MealType.objects.get_or_create(name='DN', defaults={'description': 'Night Dinner', 'time_from': '19:30', 'time_to': '21:30'})

    idli, _ = MenuItem.objects.get_or_create(name='Idli & Sambhar', defaults={'vegetarian': True})
    dosa, _ = MenuItem.objects.get_or_create(name='Masala Dosa', defaults={'vegetarian': True})
    rice, _ = MenuItem.objects.get_or_create(name='Steamed Rice & Paneer Butter Masala', defaults={'vegetarian': True})
    tea, _ = MenuItem.objects.get_or_create(name='Masala Chai & Samosa', defaults={'vegetarian': True})
    chapati, _ = MenuItem.objects.get_or_create(name='Butter Chapati & Dal Makhani', defaults={'vegetarian': True})

    # Add Mon-Sun Menu
    for day_idx in range(7):
        m_br, _ = Menu.objects.get_or_create(hostel=hostel_a, day_of_week=str(day_idx), meal_type=br)
        m_br.items.set([idli, dosa])
        m_ln, _ = Menu.objects.get_or_create(hostel=hostel_a, day_of_week=str(day_idx), meal_type=ln)
        m_ln.items.set([rice])
        m_sn, _ = Menu.objects.get_or_create(hostel=hostel_a, day_of_week=str(day_idx), meal_type=sn)
        m_sn.items.set([tea])
        m_dn, _ = Menu.objects.get_or_create(hostel=hostel_a, day_of_week=str(day_idx), meal_type=dn)
        m_dn.items.set([chapati])

    # 7. Sample Gate Passes
    today = timezone.now().date()
    GatePassRequest.objects.get_or_create(
        student=student_profile,
        hostel=hostel_a,
        out_date=today,
        out_time='18:00',
        expected_return_date=today,
        expected_return_time='21:00',
        defaults={
            'pass_type': 'DAY_OUT',
            'reason': 'Visiting City Central Library for academic project work',
            'status': 'approved',
            'approved_by': warden_user,
            'action_note': 'Approved. Ensure timely return before 9 PM.',
            'actioned_at': timezone.now()
        }
    )

    GatePassRequest.objects.get_or_create(
        student=student_profile,
        hostel=hostel_a,
        out_date=today + timedelta(days=2),
        out_time='09:00',
        expected_return_date=today + timedelta(days=4),
        expected_return_time='20:00',
        defaults={
            'pass_type': 'HOME_VISIT',
            'reason': 'Family function at hometown',
            'status': 'pending',
        }
    )

    # 8. Sample Maintenance Issue
    issue, _ = HostelIssue.objects.get_or_create(
        student=student_profile,
        hostel=hostel_a,
        room=room_101,
        title='Bathroom tap dripping continuously',
        defaults={
            'category': 'PLUMBING',
            'description': 'The bathroom faucet is leaking steadily and wasting water.',
            'status': 'in_progress',
        }
    )
    IssueUpdate.objects.get_or_create(
        issue=issue,
        old_status='pending',
        new_status='in_progress',
        defaults={'note': 'Plumber assigned. Will inspect today by 4 PM.', 'updated_by': warden_user}
    )

    # 9. Sample Visitor Log
    VisitorLog.objects.get_or_create(
        student=student_profile,
        hostel=hostel_a,
        visitor_name='David Evans (Father)',
        mobile_number='+91 9988776655',
        defaults={
            'purpose': 'Dropping study materials and personal essentials',
            'check_in_time': timezone.now() - timedelta(hours=2),
            'check_out_time': timezone.now() - timedelta(hours=1),
            'recorded_by': security_user
        }
    )

    print("[SUCCESS] Seed data populated successfully!")
    print("--------------------------------------------------")
    print("User Credentials (password: password123):")
    print("  [ADMIN]    admin / password123 (email: admin@hms.local)")
    print("  [WARDEN]   warden / password123 (email: warden@hms.local)")
    print("  [SECURITY] security / password123 (email: security@hms.local)")
    print("  [STUDENT]  student / password123 (email: student@hms.local)")
    print("--------------------------------------------------")

if __name__ == '__main__':
    seed()
