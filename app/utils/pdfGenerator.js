const PDFDocument = require("pdfkit");

/**
 * Generates an invoice PDF and returns it as a Buffer.
 * @param {Object} payment - The payment object from DB
 * @param {Object} item - The populated details (patient, doctor, appointment)
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(payment, item) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc
        .fillColor("#10b981")
        .fontSize(24)
        .text("CareConnect Invoice", { align: "center" })
        .moveDown();

      // Transaction Info
      doc
        .fillColor("#64748b")
        .fontSize(10)
        .text(`Transaction ID: ${payment.paymentId}`, { align: "right" })
        .text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`, { align: "right" })
        .moveDown();

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e2e8f0")
        .stroke()
        .moveDown();

      // Patient Details
      doc.fillColor("#333333").fontSize(12);
      doc.text(`Patient Name: ${item.p.name}`);
      doc.text(`Patient Email: ${item.p.email}`);
      doc.text(`Patient Phone: ${item.p.phone || 'N/A'}`);
      doc.moveDown();

      // Consultation Details
      doc.text(`Consultation Details:`);
      doc.text(`Doctor: Dr. ${item.d ? item.d.name : 'Clinic Specialist'}`, { indent: 20 });
      doc.text(`Department: ${item.a.department}`, { indent: 20 });
      doc.text(`Appointment Date: ${new Date(item.a.appointmentDate).toLocaleDateString()}`, { indent: 20 });
      doc.text(`Time Slot: ${item.a.appointmentTimeSlot}`, { indent: 20 });
      doc.moveDown();

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#e2e8f0")
        .stroke()
        .moveDown();

      // Amount
      doc
        .fontSize(16)
        .fillColor("#1e293b")
        .text("Total Amount Paid: ", { continued: true })
        .fillColor("#10b981")
        .text(`${payment.currency} ${payment.amount.toFixed(2)}`);

      doc.moveDown(2);

      // Footer
      doc
        .fontSize(10)
        .fillColor("#94a3b8")
        .text("This is a digitally generated invoice. Thank you for choosing CareConnect!", { align: "center", width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoicePDF };
