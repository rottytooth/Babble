const fs = require('fs-extra');
const path = require('path');

async function copyParser() {
  const sourceDir = path.join(__dirname, '..', '..', 'Parser');
  const targetDir = path.join(__dirname, '..', 'parser');
  
  try {
    // Check if Parser directory exists
    if (!(await fs.pathExists(sourceDir))) {
      console.error(`Error: Parser directory not found at ${sourceDir}`);
      console.log('Please ensure the Parser folder exists as a sibling to the Client directory');
      process.exit(1);
    }
    
    // Remove existing parser directory if it exists
    if (await fs.pathExists(targetDir)) {
      console.log('Removing existing parser directory...');
      await fs.remove(targetDir);
    }
    
    // Copy Parser contents to parser subfolder
    console.log(`Copying Parser contents from ${sourceDir} to ${targetDir}...`);
    await fs.copy(sourceDir, targetDir);
    
    console.log('✅ Parser contents copied successfully!');
    
    // List copied files for verification
    const files = await fs.readdir(targetDir);
    console.log(`Copied ${files.length} items:`, files);
    
  } catch (error) {
    console.error('❌ Error during build process:', error.message);
    process.exit(1);
  }
}

// Run the build process
copyParser();
