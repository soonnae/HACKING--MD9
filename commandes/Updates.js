const { zokou } = require("../framework/zokou");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require('crypto');

zokou({
  nomCom: "update",
  categorie: "Maintenance",
  reaction: "🔄",
  desc: "Check for new commits and update the bot",
  alias: ["upgrade"]
}, async (origineMessage, zk, commandeOptions) => {
  const { ms, msgRepondu, arg, repondre, nomAuteurMessage } = commandeOptions;
  
  zk.sendMessage(origineMessage, { text: "*COMMANDE DEVELOPPÉ Par FAMOUS-TECH, un développeur HAÏTIEN🇭🇹*" });
  
  try {
    const repoUrl = "https://api.github.com/repos/HACKING995/HACKING--MD9";
    const branchesUrl = `${repoUrl}/branches/main`;
    
    // Get the latest commit hash from the repository
    const branchResponse = await axios.get(branchesUrl);
    const latestCommitHash = branchResponse.data.commit.sha;
    
    // Get repository content tree
    const treeUrl = `${repoUrl}/git/trees/${latestCommitHash}?recursive=1`;
    const treeResponse = await axios.get(treeUrl);
    const repoFiles = treeResponse.data.tree;
    
    // Get local files with their hashes
    const localFiles = await getLocalFilesWithHash(".");
    
    // Compare files and identify differences
    const filesToUpdate = [];
    for (const repoFile of repoFiles) {
      if (repoFile.type !== "blob") continue;
      
      const localFilePath = repoFile.path;
      const localFileInfo = localFiles.get(localFilePath);
      
      if (!localFileInfo || localFileInfo.hash !== repoFile.sha) {
        filesToUpdate.push(repoFile);
      }
    }
    
    if (filesToUpdate.length === 0) {
      return repondre("Pas de mise à jour détectée pour le moment.");
    }
    
    repondre(`Mise à jour nécessaire pour ${filesToUpdate.length} fichier(s): ${filesToUpdate.map(f => f.path).join(", ")}`);
    
    // Update files
    for (const file of filesToUpdate) {
      try {
        const fileUrl = `${repoUrl}/contents/${file.path}?ref=${latestCommitHash}`;
        const fileResponse = await axios.get(fileUrl);
        const content = Buffer.from(fileResponse.data.content, 'base64');
        
        // Ensure directory exists
        const filePath = path.join(".", path.normalize(file.path));
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        
        // Write file
        fs.writeFileSync(filePath, content);
        repondre(`Fichier mis à jour: ${file.path}`);
      } catch (error) {
        repondre(`Erreur lors de la mise à jour de ${file.path}: ${error.message}`);
      }
    }
    
    repondre("Mise à jour terminée avec succès.");
    
    // Redémarrage avec PM2
    if (filesToUpdate.some(file => file.path.endsWith('.js'))) {
      repondre("Redémarrage du bot pour appliquer les mises à jour...");
      exec('pm2 restart all', (error, stdout, stderr) => {
        if (error) {
          repondre(`Erreur lors du redémarrage: ${error.message}`);
          return;
        }
        if (stderr) {
          repondre(`Avertissement lors du redémarrage: ${stderr}`);
          return;
        }
        repondre("Bot redémarré avec succès!");
      });
    }
    
  } catch (error) {
    repondre(`Erreur pendant la mise à jour: ${error.message}`);
  }
});

// Helper function to get local files with their SHA-256 hashes
async function getLocalFilesWithHash(dir) {
  const files = new Map();
  
  function processDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);
      
      // Skip node_modules and .git directories
      if (stat.isDirectory()) {
        if (item !== 'node_modules' && item !== '.git') {
          processDirectory(itemPath);
        }
        continue;
      }
      
      // Calculate file hash
      const fileContent = fs.readFileSync(itemPath);
      const hash = crypto.createHash('sha256')
        .update(`blob ${fileContent.length}\0`)
        .update(fileContent)
        .digest('hex');
      
      // Store relative path and hash
      const relativePath = path.relative('.', itemPath);
      files.set(relativePath, {
        path: relativePath,
        hash: hash
      });
    }
  }
  
  processDirectory(dir);
  return files;
}