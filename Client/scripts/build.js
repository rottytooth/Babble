const fs = require('fs-extra');
const path = require('path');
const peggy = require('peggy');

async function buildParser() {
  const parserDir = path.join(__dirname, '..', '..', 'Parser');
  const grammarFile = path.join(parserDir, 'babble.pegjs');
  const outputFile = path.join(parserDir, 'babble.parser.js');
  
  try {
    console.log('🔨 Building parser from grammar...');
    
    // Check if grammar file exists
    if (!(await fs.pathExists(grammarFile))) {
      console.error(`Error: Grammar file not found at ${grammarFile}`);
      process.exit(1);
    }
    
    // Read the PEG grammar
    const grammarContent = await fs.readFile(grammarFile, 'utf8');
    
    // Generate parser
    const parser = peggy.generate(grammarContent, {
      output: 'source',
      format: 'globals',
      exportVar: 'babble.parser'
    });
    
    // Fix the export to remove 'root.' prefix
    const fixedParser = parser.replace('root.babble.parser', 'babble.parser');
    
    // Write the generated parser
    await fs.writeFile(outputFile, fixedParser);
    console.log('✅ Parser generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating parser:', error.message);
    process.exit(1);
  }
}

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
async function main() {
  await buildParser();
  await copyParser();
}

main();
