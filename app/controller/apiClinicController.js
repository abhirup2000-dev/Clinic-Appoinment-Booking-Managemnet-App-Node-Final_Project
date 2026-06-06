const ClinicModel = require("../model/clinic.model");
const UserModel = require("../model/user.model");
const mongoose = require("mongoose");
const { emitBroadcast } = require("../utils/socketEmitter");
const { geocodeAddress } = require("../utils/geocoder");

class apiClinicController {
  async createClinic(req, res) {
    try {
      const {
        clinicName,
        email,
        phone,
        address,
        latitude,
        longitude,
        departments,
        clinicAdmin,
        subscriptionPlan,
      } = req.body;

      if (!clinicName || !email || !phone || !address) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Missing required clinic parameters",
          });
      }

      const deptArray = departments
        ? Array.isArray(departments)
          ? departments
          : departments
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean)
        : [];

      let finalLat = latitude ? parseFloat(latitude) : 0;
      let finalLng = longitude ? parseFloat(longitude) : 0;

      // Automatically geocode if coordinates are missing
      if (!latitude || !longitude) {
        const geoResult = await geocodeAddress(address);
        if (geoResult) {
          finalLat = geoResult.latitude;
          finalLng = geoResult.longitude;
        }
      }

      const newClinic = await ClinicModel.create({
        clinicName,
        email,
        phone,
        address,
        departments: deptArray,
        location: {
          type: "Point",
          coordinates: [finalLng, finalLat],
        },
        clinicAdmin: clinicAdmin
          ? new mongoose.Types.ObjectId(clinicAdmin)
          : null,
        subscriptionPlan: subscriptionPlan || "free",
        logo: req.file
          ? req.file.path
          : "https://placehold.co/150x150?text=" +
            encodeURIComponent(clinicName),
        publicId: req.file ? req.file.filename : "",
      });

      // Broadcast clinic creation to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "added",
        title: "New Clinic Added",
        message: `${newClinic.clinicName} is now available on CareConnect.`,
        clinicId: newClinic._id,
        clinicName: newClinic.clinicName,
      });

      return res.status(201).json({
        success: true,
        message: "Clinic successfully created",
        data: newClinic,
      });
    } catch (error) {
      console.error("Create Clinic Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to create clinic",
          error: error.message,
        });
    }
  }

  async getAllClinics(req, res) {
    try {
      // Strictly use MongoDB Aggregation
      const clinics = await ClinicModel.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "clinicAdmin",
            foreignField: "_id",
            as: "adminDetails",
          },
        },
        {
          $unwind: {
            path: "$adminDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            clinicName: 1,
            email: 1,
            phone: 1,
            address: 1,
            logo: 1,
            departments: 1,
            subscriptionPlan: 1,
            averageRating: 1,
            isVerified: 1,
            createdAt: 1,
            adminDetails: {
              _id: "$adminDetails._id",
              name: "$adminDetails.name",
              email: "$adminDetails.email",
            },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        count: clinics.length,
        data: clinics,
      });
    } catch (error) {
      console.error("Get All Clinics Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to load clinics",
          error: error.message,
        });
    }
  }

  async getClinicById(req, res) {
    try {
      const clinicId = new mongoose.Types.ObjectId(req.params.id);

      // Strictly use MongoDB Aggregation to join admin details and doctors
      const clinicData = await ClinicModel.aggregate([
        { $match: { _id: clinicId } },
        {
          $lookup: {
            from: "users",
            localField: "clinicAdmin",
            foreignField: "_id",
            as: "adminDetails",
          },
        },
        {
          $unwind: {
            path: "$adminDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Join doctors assigned to this clinic
        {
          $lookup: {
            from: "users",
            let: { clinicId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinic", "$$clinicId"] },
                      { $eq: ["$role", "doctor"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  password: 0,
                  refreshToken: 0,
                },
              },
            ],
            as: "doctors",
          },
        },
        {
          $project: {
            clinicName: 1,
            email: 1,
            phone: 1,
            address: 1,
            logo: 1,
            departments: 1,
            subscriptionPlan: 1,
            averageRating: 1,
            isVerified: 1,
            createdAt: 1,
            adminDetails: {
              _id: "$adminDetails._id",
              name: "$adminDetails.name",
              email: "$adminDetails.email",
            },
            doctors: 1,
          },
        },
      ]);

      if (clinicData.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      return res.status(200).json({
        success: true,
        data: clinicData[0],
      });
    } catch (error) {
      console.error("Get Clinic By Id Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to retrieve clinic details",
          error: error.message,
        });
    }
  }

  async updateClinic(req, res) {
    try {
      const { id } = req.params;
      const {
        clinicName,
        email,
        phone,
        address,
        latitude,
        longitude,
        departments,
        clinicAdmin,
        subscriptionPlan,
        isVerified,
      } = req.body;

      const clinic = await ClinicModel.findById(id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      const deptArray = departments
        ? Array.isArray(departments)
          ? departments
          : departments
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean)
        : clinic.departments;

      clinic.clinicName = clinicName || clinic.clinicName;
      clinic.email = email || clinic.email;
      clinic.phone = phone || clinic.phone;
      clinic.address = address || clinic.address;
      clinic.departments = deptArray;
      clinic.clinicAdmin = clinicAdmin
        ? new mongoose.Types.ObjectId(clinicAdmin)
        : clinic.clinicAdmin;
      clinic.subscriptionPlan = subscriptionPlan || clinic.subscriptionPlan;
      clinic.isVerified =
        isVerified !== undefined ? isVerified : clinic.isVerified;

      if (latitude && longitude) {
        clinic.location = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        };
      } else if (address && clinic.address !== address) {
        // Automatically geocode if the address was changed and coordinates were not explicitly provided
        const geoResult = await geocodeAddress(address);
        if (geoResult) {
          clinic.location = {
            type: "Point",
            coordinates: [geoResult.longitude, geoResult.latitude],
          };
        }
      } else if (!clinic.location || (clinic.location.coordinates[0] === 0 && clinic.location.coordinates[1] === 0)) {
        // Automatically geocode if no coordinates exist at all
         const geoResult = await geocodeAddress(clinic.address);
         if (geoResult) {
           clinic.location = {
             type: "Point",
             coordinates: [geoResult.longitude, geoResult.latitude],
           };
         }
      }

      if (req.file) {
        clinic.logo = req.file.path;
        clinic.publicId = req.file.filename;
      }

      await clinic.save();

      // Broadcast clinic update to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "updated",
        title: "Clinic Details Updated",
        message: `${clinic.clinicName} has been updated.`,
        clinicId: clinic._id,
        clinicName: clinic.clinicName,
      });

      return res.status(200).json({
        success: true,
        message: "Clinic updated successfully",
        data: clinic,
      });
    } catch (error) {
      console.error("Update Clinic Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to update clinic",
          error: error.message,
        });
    }
  }

  async deleteClinic(req, res) {
    try {
      const { id } = req.params;
      const clinic = await ClinicModel.findByIdAndDelete(id);

      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Broadcast clinic removal to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "removed",
        title: "Clinic Removed",
        message: `A clinic has been removed from CareConnect.`,
        clinicId: id,
      });

      return res.status(200).json({
        success: true,
        message: "Clinic successfully deleted",
      });
    } catch (error) {
      console.error("Delete Clinic Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to delete clinic",
          error: error.message,
        });
    }
  }

  async getNearByClinics(req, res) {
    try {
      const { lat, lng, maxDistance = 10000 } = req.query; // maxDistance in meters (10km default)

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: "Latitude (lat) and Longitude (lng) are required",
        });
      }

      const userCoordinates = [parseFloat(lng), parseFloat(lat)];

      const nearbyClinics = await ClinicModel.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: userCoordinates },
            distanceField: "distance", // In meters
            maxDistance: parseFloat(maxDistance),
            spherical: true,
          },
        },
        // Count doctors in this clinic
        {
          $lookup: {
            from: "users",
            let: { clinicId: "$_id" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$clinic", "$$clinicId"] }, { $eq: ["$role", "doctor"] }] } } },
              { $count: "count" }
            ],
            as: "doctorCountInfo"
          }
        },
        {
          $addFields: {
            doctorCount: {
              $ifNull: [{ $arrayElemAt: ["$doctorCountInfo.count", 0] }, 0]
            },
            // Convert distance to km, round to 1 decimal
            distanceKm: { $round: [{ $divide: ["$distance", 1000] }, 1] }
          }
        },
        {
          $project: {
            clinicName: 1,
            address: 1,
            logo: 1,
            departments: 1,
            averageRating: 1,
            distanceKm: 1,
            doctorCount: 1,
            location: 1,
            isVerified: 1
          }
        }
      ]);

      return res.status(200).json({
        success: true,
        count: nearbyClinics.length,
        data: nearbyClinics,
      });

    } catch (error) {
      console.error("Get Nearby Clinics Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve nearby clinics",
        error: error.message,
      });
    }
  }
  async syncGeocodes(req, res) {
    try {
      // Find all clinics with default [0, 0] coordinates or missing location
      const clinics = await ClinicModel.find({
        $or: [
          { location: { $exists: false } },
          { "location.coordinates": [0, 0] },
        ],
      });

      let updatedCount = 0;
      let failedCount = 0;

      for (const clinic of clinics) {
        const geoResult = await geocodeAddress(clinic.address);
        if (geoResult) {
          clinic.location = {
            type: "Point",
            coordinates: [geoResult.longitude, geoResult.latitude],
          };
          await clinic.save();
          updatedCount++;
        } else {
          failedCount++;
        }
        
        // Add a small delay to respect Nominatim rate limits (1 request per second max)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      return res.status(200).json({
        success: true,
        message: `Geocoding sync complete. Updated: ${updatedCount}, Failed: ${failedCount}`,
      });
    } catch (error) {
      console.error("Sync Geocoding Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to sync clinic geocodes",
        error: error.message,
      });
    }
  }
}

module.exports = new apiClinicController();
