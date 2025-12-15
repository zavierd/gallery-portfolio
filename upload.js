#!/usr/bin/env node

/**
 * 本地图片上传工具
 * 支持上传图片到 Cloudflare R2 并自动生成预览图
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import readline from "readline";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import sharp from "sharp";

dotenv.config();

// 配置
const BUCKET = process.env.R2_BUCKET_NAME;
const ENDPOINT = process.env.R2_ENDPOINT;
const REGION = process.env.R2_REGION || "auto";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const IMAGE_DIR = process.env.R2_IMAGE_DIR || "";
const COMPRESSION_QUALITY = parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

// 初始化 S3 客户端
const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// 获取现有分类
async function getExistingCategories() {
  const categories = new Set();
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: IMAGE_DIR,
      Delimiter: "/",
      ContinuationToken: continuationToken,
    });

    const response = await s3.send(command);

    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        const categoryName = prefix.Prefix.replace(IMAGE_DIR, "").replace(/\//g, "");
        if (categoryName && categoryName !== "0_preview") {
          categories.add(categoryName);
        }
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(categories).sort();
}

// 上传文件到 R2
async function uploadFile(localPath, r2Key, contentType) {
  const fileContent = fs.readFileSync(localPath);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
  });

  await s3.send(command);
}

// 上传 Buffer 到 R2
async function uploadBuffer(buffer, r2Key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3.send(command);
}

// 生成预览图
async function generatePreview(imagePath) {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  // 预览图最大宽度 800px
  const maxWidth = 800;
  const width = metadata.width > maxWidth ? maxWidth : metadata.width;

  return image
    .resize(width)
    .webp({ quality: COMPRESSION_QUALITY })
    .toBuffer();
}

// 获取 MIME 类型
function getMimeType(ext) {
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
  };
  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}

// 主函数
async function main() {
  console.log("========================================");
  console.log("    图片上传工具 (Cloudflare R2)");
  console.log("========================================\n");

  // 检查配置
  if (!BUCKET || !ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
    console.error("错误: 请先配置 .env 文件！");
    console.log("复制 .env_template 为 .env 并填写配置。");
    rl.close();
    process.exit(1);
  }

  // 获取图片路径
  const inputPath = await question("请输入图片路径（支持文件或文件夹）: ");
  const resolvedPath = path.resolve(inputPath.trim().replace(/^["']|["']$/g, ""));

  if (!fs.existsSync(resolvedPath)) {
    console.error("错误: 路径不存在！");
    rl.close();
    process.exit(1);
  }

  // 收集要上传的图片
  let imagesToUpload = [];
  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    const ext = path.extname(resolvedPath).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) {
      imagesToUpload.push(resolvedPath);
    } else {
      console.error("错误: 不支持的图片格式！");
      rl.close();
      process.exit(1);
    }
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(resolvedPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        imagesToUpload.push(path.join(resolvedPath, file));
      }
    }
  }

  if (imagesToUpload.length === 0) {
    console.error("错误: 没有找到可上传的图片！");
    rl.close();
    process.exit(1);
  }

  console.log(`\n找到 ${imagesToUpload.length} 张图片待上传。\n`);

  // 获取现有分类
  console.log("正在获取现有分类...");
  const existingCategories = await getExistingCategories();

  if (existingCategories.length > 0) {
    console.log("\n现有分类:");
    existingCategories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat}`);
    });
    console.log(`  ${existingCategories.length + 1}. [创建新分类]`);
  }

  // 选择分类
  let category;
  const categoryChoice = await question("\n请选择分类（输入编号或直接输入新分类名称）: ");
  const choiceNum = parseInt(categoryChoice);

  if (choiceNum > 0 && choiceNum <= existingCategories.length) {
    category = existingCategories[choiceNum - 1];
  } else {
    category = categoryChoice.trim();
  }

  if (!category) {
    console.error("错误: 分类名称不能为空！");
    rl.close();
    process.exit(1);
  }

  console.log(`\n将上传到分类: ${category}\n`);

  // 是否生成预览图
  const generatePreviewChoice = await question("是否生成预览图？(Y/n): ");
  const shouldGeneratePreview = generatePreviewChoice.toLowerCase() !== "n";

  // 开始上传
  console.log("\n开始上传...\n");

  let successCount = 0;
  let failCount = 0;

  for (const imagePath of imagesToUpload) {
    const fileName = path.basename(imagePath);
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    try {
      // 上传原图
      const originalKey = IMAGE_DIR ? `${IMAGE_DIR}/${category}/${fileName}` : `${category}/${fileName}`;
      console.log(`上传: ${fileName}`);
      await uploadFile(imagePath, originalKey, getMimeType(ext));

      // 生成并上传预览图
      if (shouldGeneratePreview) {
        const previewBuffer = await generatePreview(imagePath);
        const previewKey = IMAGE_DIR 
          ? `${IMAGE_DIR}/0_preview/${category}/${baseName}.webp`
          : `0_preview/${category}/${baseName}.webp`;
        await uploadBuffer(previewBuffer, previewKey, "image/webp");
        console.log(`  ✓ 预览图已生成`);
      }

      successCount++;
      console.log(`  ✓ 完成\n`);
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}\n`);
      failCount++;
    }
  }

  // 完成
  console.log("========================================");
  console.log("上传完成！");
  console.log(`成功: ${successCount} 张`);
  if (failCount > 0) {
    console.log(`失败: ${failCount} 张`);
  }
  console.log("========================================");

  // 提示更新索引
  const updateIndex = await question("\n是否立即更新图片索引？(Y/n): ");
  if (updateIndex.toLowerCase() !== "n") {
    console.log("\n正在更新索引...\n");
    const { exec } = await import("child_process");
    exec("node generate-gallery-index-r2.js", (error, stdout, stderr) => {
      if (error) {
        console.error("更新索引失败:", error.message);
      } else {
        console.log(stdout);
      }
      rl.close();
    });
  } else {
    console.log("\n请稍后手动运行: npm run r2:generate-index");
    rl.close();
  }
}

main().catch((err) => {
  console.error("发生错误:", err.message);
  rl.close();
  process.exit(1);
});
