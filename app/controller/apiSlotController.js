const ClinicModel = require("../model/clinic.model");
const UserModel = require("../model/user.model");
const AppointmentModel = require("../model/appointment.model");
const mongoose = require("mongoose");

class apiSlotController {
  /**
   * Get all departments for a specific clinic.
   * Used for Step 2 of the Smart Appointment Form.
   */
  async getDepartmentsByClinic(req, res) {
    try {
      const { clinicId } = req.params;

      const clinic = await ClinicModel.findById(clinicId).select("departments").lean();
      const departments = clinic ? clinic.departments : [];

      return res.status(200).json({
        success: true,
        data: departments,
      });
    } catch (error) {
      console.error("Get Departments Error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load departments" });
    }
  }

  /**
   * Get all active doctors in a specific department for a clinic.
   * Used for Step 3 of the Smart Appointment Form.
   */
  async getDoctorsByDepartment(req, res) {
    try {
      const { clinicId, departmentName } = req.params;

      // Use case-insensitive regex so "Cardiology" matches "cardiology" etc.
      const doctors = await UserModel.find({
        role: "doctor",
        clinic: clinicId,
        specialization: { $regex: new RegExp(`^${departmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
        status: { $ne: "blocked" },
      })
        .select(
          "name specialization consultationFee profilePicture gender experience",
        )
        .sort({ name: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: doctors,
      });
    } catch (error) {
      console.error("Get Doctors Error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load doctors" });
    }
  }

  /**
   * Get available time slots for a specific doctor on a specific date.
   * Used for Step 4 of the Smart Appointment Form.
   */
  async getAvailableSlots(req, res) {
    try {
      const { doctorId } = req.params;
      const { date } = req.query; // YYYY-MM-DD

      if (!date) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Date parameter is required (YYYY-MM-DD)",
          });
      }

      const targetDoctorId = new mongoose.Types.ObjectId(doctorId);

      // Parse the date safely
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid date format" });
      }

      parsedDate.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(parsedDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Standard active timeslots available per day
      const standardSlots = [
        "09:00 AM - 10:00 AM",
        "10:00 AM - 11:00 AM",
        "11:00 AM - 12:00 PM",
        "02:00 PM - 03:00 PM",
        "03:00 PM - 04:00 PM",
        "04:00 PM - 05:00 PM",
      ];

      // Retrieve all booked timeslots on that date using aggregation
      const bookedAppointments = await AppointmentModel.aggregate([
        {
          $match: {
            doctor: targetDoctorId,
            appointmentDate: {
              $gte: parsedDate,
              $lt: nextDay,
            },
            status: { $nin: ["cancelled", "completed"] },
          },
        },
        {
          $project: {
            appointmentTimeSlot: 1,
          },
        },
      ]);

      const bookedSlots = bookedAppointments.map(
        (appt) => appt.appointmentTimeSlot,
      );

      // Filter available timeslots
      const availableSlots = standardSlots.filter(
        (slot) => !bookedSlots.includes(slot),
      );

      return res.status(200).json({
        success: true,
        date: parsedDate.toISOString().split("T")[0],
        totalSlots: standardSlots.length,
        bookedCount: bookedSlots.length,
        availableSlots,
        bookedSlots,
      });
    } catch (error) {
      console.error("Get Available Slots Error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load slots" });
    }
  }
}

module.exports = new apiSlotController();
