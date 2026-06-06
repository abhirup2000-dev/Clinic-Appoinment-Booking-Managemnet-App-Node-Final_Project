const PaymentModel = require("../model/payment.model");
const AppointmentModel = require("../model/appointment.model");
const UserModel = require("../model/user.model");
const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { sendEmail } = require("../config/emailconfig");
const { generateInvoicePDF } = require("../utils/pdfGenerator");

class apiPaymentController {
  async createOrder(req, res) {
    try {
      const { appointmentId, amount } = req.body;
      const patientId = req.user.userId;

      if (!amount) {
        return res.status(400).json({ success: false, message: "Amount is required" });
      }

      // 1. Create a Razorpay Order
      const options = {
        amount: Math.round(parseFloat(amount) * 100), // Razorpay works in paise
        currency: "INR",
        receipt: `receipt_appt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      // 2. Save payment record in DB with "created" status
      const payment = await PaymentModel.create({
        patient: patientId,
        appointment: appointmentId ? new mongoose.Types.ObjectId(appointmentId) : null,
        amount: parseFloat(amount),
        currency: "INR",
        orderId: order.id,
        status: "created",
      });

      return res.status(201).json({
        success: true,
        message: "Razorpay order successfully created",
        orderId: order.id,
        amount: options.amount,
        currency: options.currency,
        paymentId: payment._id,
      });
    } catch (error) {
      console.error("Create Order Error:", error);
      return res.status(500).json({ success: false, message: "Failed to generate Razorpay order", error: error.message });
    }
  }

  async verifyPayment(req, res) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: "Missing required Razorpay signature parameters" });
      }

      // Verify the signature
      const text = razorpay_order_id + "|" + razorpay_payment_id;
      const generated_signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

      const isSignatureValid = generated_signature === razorpay_signature;

      if (!isSignatureValid) {
        // Mark payment as failed in DB
        await PaymentModel.findOneAndUpdate({ orderId: razorpay_order_id }, { status: "failed" });
        return res.status(400).json({ success: false, message: "Payment signature verification failed" });
      }

      // Update payment record in DB
      const payment = await PaymentModel.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "paid", paymentId: razorpay_payment_id },
        { new: true }
      );

      if (!payment) {
        return res.status(404).json({ success: false, message: "Associated payment ledger not found in local DB" });
      }

      // Optionally update the appointment payment status or overall status
      await AppointmentModel.findByIdAndUpdate(payment.appointment, { paymentStatus: "paid" });

      // Load patient details using aggregation
      const patientInfo = await PaymentModel.aggregate([
        { $match: { _id: payment._id } },
        { $lookup: { from: "users", localField: "patient", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $lookup: { from: "appointments", localField: "appointment", foreignField: "_id", as: "a" } },
        { $unwind: "$a" },
        { $lookup: { from: "users", localField: "a.doctor", foreignField: "_id", as: "d" } },
        { $unwind: { path: "$d", preserveNullAndEmptyArrays: true } },
      ]);

      if (patientInfo.length > 0) {
        const item = patientInfo[0];
        
        // Generate PDF Invoice
        let pdfBuffer;
        try {
          pdfBuffer = await generateInvoicePDF(payment, item);
        } catch (pdfErr) {
          console.error("PDF Generation Error:", pdfErr);
        }

        // Send Payment Successful Email with a mock HTML invoice and PDF attachment
        sendEmail({
          to: item.p.email,
          subject: "Payment Success Invoice - CareConnect",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; max-width: 600px; color: #333;">
              <h2 style="color: #10b981; margin-bottom: 5px;">CareConnect Invoice</h2>
              <p style="color: #64748b; font-size: 12px; margin-top: 0;">Transaction ID: ${razorpay_payment_id}</p>
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
              
              <table style="width: 100%; font-size: 14px; line-height: 24px;">
                <tr>
                  <td><strong>Patient Name:</strong></td>
                  <td style="text-align: right;">${item.p.name}</td>
                </tr>
                <tr>
                  <td><strong>Doctor Consulted:</strong></td>
                  <td style="text-align: right;">${item.d ? item.d.name : 'Clinic Specialist'}</td>
                </tr>
                <tr>
                  <td><strong>Department:</strong></td>
                  <td style="text-align: right;">${item.a.department}</td>
                </tr>
                <tr>
                  <td><strong>Consultation Date:</strong></td>
                  <td style="text-align: right;">${new Date(item.a.appointmentDate).toLocaleDateString()}</td>
                </tr>
              </table>
              
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #1e293b;">
                <span>Total Amount Paid:</span>
                <span style="color: #10b981;">INR ${payment.amount.toFixed(2)}</span>
              </div>
              <p style="margin-top: 30px; font-size: 11px; text-align: center; color: #94a3b8;">This is a digitally generated invoice. Thank you for choosing CareConnect!</p>
            </div>
          `,
          attachments: pdfBuffer ? [
            {
              filename: 'invoice.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf'
            }
          ] : []
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment successfully verified and logged",
        data: payment,
      });
    } catch (error) {
      console.error("Verify Payment Error:", error);
      return res.status(500).json({ success: false, message: "Payment verification process crashed", error: error.message });
    }
  }

  async getAllPayments(req, res) {
    try {
      // Strictly use MongoDB Aggregation
      const payments = await PaymentModel.aggregate([
        { $lookup: { from: "users", localField: "patient", foreignField: "_id", as: "patientDetails" } },
        { $unwind: "$patientDetails" },
        { $lookup: { from: "appointments", localField: "appointment", foreignField: "_id", as: "appointmentDetails" } },
        { $unwind: "$appointmentDetails" },
        {
          $project: {
            amount: 1,
            currency: 1,
            orderId: 1,
            paymentId: 1,
            status: 1,
            createdAt: 1,
            patientDetails: { _id: "$patientDetails._id", name: "$patientDetails.name", email: "$patientDetails.email" },
            appointmentDetails: { _id: "$appointmentDetails._id", department: "$appointmentDetails.department", appointmentDate: "$appointmentDetails.appointmentDate" },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        count: payments.length,
        data: payments,
      });
    } catch (error) {
      console.error("Get All Payments Error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve payments ledger", error: error.message });
    }
  }

  async refundPayment(req, res) {
    try {
      const { id } = req.params; // payment document ID

      const payment = await PaymentModel.findById(id);
      if (!payment) {
        return res.status(404).json({ success: false, message: "Payment record not found" });
      }

      if (payment.status !== "paid") {
        return res.status(400).json({ success: false, message: "Only completed (paid) orders can be refunded" });
      }

      // Trigger Razorpay Refund API
      const refund = await razorpay.payments.refund(payment.paymentId, {
        amount: payment.amount * 100, // paise
        notes: { reason: "Patient cancelled/rescheduled appointment" },
      });

      payment.status = "refunded";
      await payment.save();

      // Update payment status on associated appointment
      await AppointmentModel.findByIdAndUpdate(payment.appointment, { paymentStatus: "refunded" });

      return res.status(200).json({
        success: true,
        message: "Refund order successfully generated and verified",
        refundId: refund.id,
        data: payment,
      });
    } catch (error) {
      console.error("Refund Payment Error:", error);
      return res.status(500).json({ success: false, message: "Refund execution failed", error: error.message });
    }
  }
}

module.exports = new apiPaymentController();
