require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: "*",
  }),
);

//swagger
const swaggerDocs = require("./swagger");
//S3
const AWS = require("aws-sdk");
const multer = require("multer");
//#region S3
AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  sessionToken: process.env.SESSION_TOKEN,
});

const s3 = new AWS.S3();

/**
 * @swagger
 * /buckets:
 *   get:
 *     summary: Lista todos os buckets
 *     tags:
 *       - Buckets
 *     responses:
 *       200:
 *         description: Lista de todos os buckets
 */
app.get("/buckets", async (req, res) => {
  try {
    const result = await s3.listBuckets().promise();
    console.log("Buckets encontrados");
    res.status(200).json(result.Buckets || []);
  } catch (error) {
    console.log("Erro ao buscar buckets", error);
    res
      .status(500)
      .json({ error: "Erro ao listar buckets", details: error.message });
  }
});

/**
 * @swagger
 * /buckets/{bucketName}:
 *   get:
 *     summary: Lista os objetos de um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *     responses:
 *       200:
 *         description: Lista dos objetos do bucket
 */
app.get("/buckets/:bucketName", async (req, res) => {
  try {
    const { bucketName } = req.params;
    const result = await s3.listObjectsV2({ Bucket: bucketName }).promise();
    console.log("Objetos encontrados");
    res.status(200).json(result.Contents || []);
  } catch (error) {
    console.log("Erro ao buscar objetos", error);
    res
      .status(500)
      .json({
        error: "Erro ao listar objetos do bucket",
        details: error.message,
      });
  }
});

/**
 * @swagger
 * /buckets/{bucketName}/upload:
 *   post:
 *     summary: Faz o upload de um arquivo para um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Arquivo enviado com sucesso
 */
//Utilizar alguma lib para fazer o upload/strem de arquivos, sugestão: multer
// Configuração do multer para armazenar em memória
const upload = multer({ storage: multer.memoryStorage() });
app.post(
  "/buckets/:bucketName/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const { bucketName } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Arquivo não enviado. Use o campo file." });
      }

      const key = `${Date.now()}-${req.file.originalname}`;
      const result = await s3
        .upload({
          Bucket: bucketName,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
        .promise();

      console.log("Upload efetuado");
      res.status(200).json({
        message: "Arquivo enviado com sucesso",
        key,
        url: result.Location,
      });
    } catch (error) {
      console.log("Erro ao efetuar upload", error);
      res.status(500).json({ message: "Erro no upload", error: error.message });
    }
  },
);

/**
 * @swagger
 * /buckets/{bucketName}/file/{fileName}:
 *   delete:
 *     summary: Deleta um arquivo específico de um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *       - in: path
 *         name: fileName
 *         required: true
 *         description: Nome do arquivo a ser deletado
 *     responses:
 *       200:
 *         description: Arquivo deletado com sucesso
 */
app.delete("/buckets/:bucketName/file/:fileName", async (req, res) => {
  try {
    const { bucketName, fileName } = req.params;
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: fileName,
      })
      .promise();

    console.log("Objeto removido");
    res.status(200).json({ message: "Objeto removido com sucesso", fileName });
  } catch (error) {
    console.log("Erro ao remover objeto", error);
    res
      .status(500)
      .json({ message: "Erro ao remover objeto", error: error.message });
  }
});
//#endregion

swaggerDocs(app);
app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
