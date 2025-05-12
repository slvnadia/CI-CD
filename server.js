const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { predictCancer } = require('./predictor');
const { Firestore } = require('@google-cloud/firestore');

// Mengonfigurasi kredensial Firebase untuk Firestore
const firestore = new Firestore({
  keyFilename: 'firestore_cred.json',
});

// Misalnya, untuk menyimpan data prediksi
async function savePredictionToFirestore(predictionData) {
  const docRef = firestore.collection('predictions').doc(predictionData.id);  // ID yang digunakan sebagai nama dokumen
  await docRef.set(predictionData);  // Menyimpan data hasil prediksi ke Firestore
}

const app = express();
const port = 8080;
const host = '0.0.0.0';

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'change with your url'); // URL frontend Anda
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });
  

// Konfigurasi Multer untuk upload file
const upload = multer({
  limits: { fileSize: 1000000 }, // Maksimum 1MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
}).single('image');

// Endpoint prediksi
app.post('/predict', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'fail',
          message: 'Payload content length greater than maximum allowed: 1000000',
        });
      }
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid file upload',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded',
      });
    }

    try {
      // Lakukan prediksi
      const result = await predictCancer(req.file.buffer);

      // Simpan data hasil prediksi
      const predictionData = {
        id: uuidv4(),
        result: result === 'Cancer' ? 'Cancer' : 'Non-cancer',
        suggestion: result === 'Cancer' ? 'Segera periksa ke dokter!' : 'Penyakit kanker tidak terdeteksi.',
        createdAt: moment().toISOString(),
      };

      await savePredictionToFirestore(predictionData);

      // Change status code to 201 as expected by Postman test
      res.status(201).json({
        status: 'success',
        message: 'Model is predicted successfully',
        data: predictionData,
      });
    } catch (error) {
      console.error('Prediction error:', error);
      res.status(400).json({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi',
      });
    }
  });
});

app.get('/predict/histories', async (req, res) => {
    try {
      // Ambil semua dokumen dari koleksi 'predictions'
      const snapshot = await firestore.collection('predictions').get();
      
      if (snapshot.empty) {
        return res.status(404).json({
          status: 'fail',
          message: 'No predictions found',
        });
      }
  
      // Proses setiap dokumen dan format data untuk response
      const histories = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,  // Menggunakan ID dokumen Firestore sebagai ID riwayat
          history: {
            result: data.result,
            createdAt: data.createdAt,
            suggestion: data.suggestion,
            id: doc.id,  // Menyimpan ID dokumen di dalam 'history'
          }
        };
      });
  
      // Kirim response dengan status success dan data
      res.status(200).json({
        status: 'success',
        data: histories,
      });
  
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({
        status: 'fail',
        message: 'Terjadi kesalahan saat mengambil riwayat prediksi',
      });
    }
  });
  

// Jalankan server
app.listen(port, host, () => {
    console.log(`Server is running on ${host}:${port}`);
});


