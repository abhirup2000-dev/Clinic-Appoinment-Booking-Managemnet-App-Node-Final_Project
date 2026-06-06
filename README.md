# 🏥 Clinic Appointment Management System

A full-stack Clinic Appointment Management System that allows patients to book appointments online, doctors to manage schedules, and administrators to oversee clinics, doctors, appointments, and payments efficiently.

## 🚀 Features

### 👨‍⚕️ Patient Module
- User Registration & Login
- Secure Authentication
- Search Clinics
- Browse Doctors by Department
- Book Appointments
- Appointment History
- Online Payment Integration
- Profile Management

### 👨‍⚕️ Doctor Module
- Doctor Dashboard
- View Upcoming Appointments
- Manage Availability
- Patient Information Access
- Appointment Status Updates

### 🏥 Clinic Module
- Clinic Registration
- Manage Doctors
- Manage Departments
- View Bookings
- Clinic Profile Management

### 👨‍💼 Admin Module
- Admin Dashboard
- Manage Clinics
- Manage Doctors
- Manage Patients
- Appointment Monitoring
- Revenue Tracking
- Analytics & Reports

### 💳 Payment Integration
- Razorpay Payment Gateway
- Secure Online Transactions
- Payment Verification

### 📞 Communication Features
- Live Chat Support
- Appointment Notifications
- Email Notifications

### ⚡ Performance Optimization
- Redis Caching
- MongoDB Indexing
- Optimized API Responses

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose

### Frontend
- EJS
- HTML5
- CSS3
- Bootstrap
- JavaScript

### Cloud Services
- Cloudinary (Image Uploads)
- Redis (Caching)

### Payment Gateway
- Razorpay

### Authentication
- JWT Authentication
- Bcrypt Password Hashing

---

## 📂 Project Structure

```bash
Clinic_Appointment_Management_System/
├── app/
│   ├── config/
│   ├── controller/
│   ├── middleware/
│   ├── model/
│   ├── routes/
│   ├── service/
│   ├── socket/
│   ├── utils/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── views/
├── .env
├── app.js
├── package.json
└── README.md
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/abhirup2000-dev/Clinic_Appoinmnt_Booking_Application_Final_Project.git
```

```bash
cd Clinic_Appoinmnt_Booking_Application_Final_Project
```

### Install Dependencies

```bash
npm install
```

### Create Environment Variables

Create a `.env` file in the root directory.

```env
PORT=6001

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

SESSION_SECRET=your_session_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

REDIS_URL=your_redis_url
```

---

## ▶️ Run the Project

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

---

## 📸 Screenshots

Add screenshots of:

- Home Page
- Doctor Listing
- Clinic Dashboard
- Appointment Booking
- Admin Dashboard
- Payment Page

---

## 🔒 Security Features

- Password Hashing using Bcrypt
- JWT Authentication
- Session Management
- Environment Variable Protection
- Input Validation
- Secure Payment Verification

---

## 🌐 Deployment

The application can be deployed on:

- Render
- Railway
- VPS Servers
- AWS EC2
- DigitalOcean

---

## 📊 Future Enhancements

- Video Consultation
- Prescription Management
- Medical Records Storage
- SMS Notifications
- AI-powered Appointment Suggestions
- Multi-language Support

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Added new feature"
```

4. Push to branch

```bash
git push origin feature-name
```

5. Create a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Developer

**Abhirup Ghosh**

GitHub: https://github.com/abhirup2000-dev

---

⭐ If you found this project useful, consider giving it a star on GitHub.
