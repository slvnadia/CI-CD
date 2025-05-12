const tf = require('@tensorflow/tfjs-node');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Read cloud credentials from JSON file
const fileContent = fs.readFileSync('cloud_cred.json', 'utf-8');
const gcloudCreds = JSON.parse(fileContent);

// Initialize Google Cloud Storage with credentials
const storage = new Storage({
  credentials: gcloudCreds,
  projectId: gcloudCreds.project_id
});

// Google Cloud Storage details
const BUCKET_NAME = 'change with your bucket name'; 
const MODEL_PATH = 'model';  // Path to the folder containing model.json and shard files

let model;

// Load the model from Google Cloud Storage
const loadModel = async () => {
  if (model) return model;  // Return the model if it has already been loaded

  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir); // Create temp directory if not exists

  // Download the model.json file
  const modelJsonPath = path.join(tempDir, 'model.json');
  await storage.bucket(BUCKET_NAME).file(`${MODEL_PATH}/model.json`).download({ destination: modelJsonPath });

  // Download all the shard files (e.g., group1-shardXofY.bin)
  const shardFiles = await storage.bucket(BUCKET_NAME).getFiles({ prefix: `${MODEL_PATH}/group1-shard` });
  
  // Ensure shard files are downloaded correctly
  await Promise.all(
    shardFiles[0].map((file) =>
      file.download({ destination: path.join(tempDir, path.basename(file.name)) })
    )
  );

  // Now, load the model using TensorFlow.js with the downloaded files
  model = await tf.loadGraphModel(`file://${modelJsonPath}`);

  return model;
};

const preprocessImage = (imageBuffer) => {
  return tf.node.decodeImage(imageBuffer)  // Decode image buffer menjadi tensor
    .resizeBilinear([224, 224])             // Resize ke ukuran yang diinginkan
    .expandDims(0)                          // Tambahkan dimensi batch (1)
    .div(255.0);                            // Normalisasi nilai pixel ke range [0, 1]
};

// Predict cancer or non-cancer from an image
const predictCancer = async (imageBuffer) => {
  const model = await loadModel();  // Load model once when needed
  const imageTensor = preprocessImage(imageBuffer); 
  const predictions = model.predict(imageTensor);
  const predictionData = predictions.dataSync()
  console.log("Prediction Data: ", predictionData); // for debuuuggggggggggggggggggggggg
  
  // Preprocess the image (resize, normalize
  
  // Make prediction
  
  const threshold = 0.58
  const result = predictions.dataSync()[0]; // Get prediction result
  // Return the result as 'Cancer' or 'Non-cancer'
  return result > threshold ? 'Cancer' : 'Non-cancer';
};

module.exports = { predictCancer };
