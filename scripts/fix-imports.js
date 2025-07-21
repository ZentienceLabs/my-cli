import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

async function fixImports(dir) {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dir, file.name);
    
    if (file.isDirectory()) {
      await fixImports(filePath);
    } else if (extname(file.name) === '.js') {
      let content = await readFile(filePath, 'utf-8');
      
      // Fix both ./ and ../ relative imports in from statements
      content = content.replace(
        /from\s+['"](\.\.[^'"]*|\.\/[^'"]*)['"];/g,
        (match, path) => {
          if (path.endsWith('.js')) return match;
          return match.replace(path, path + '.js');
        }
      );
      
      // Fix both ./ and ../ relative imports in import statements
      content = content.replace(
        /import\s+[^'"]*from\s+['"](\.\.[^'"]*|\.\/[^'"]*)['"];/g,
        (match, path) => {
          if (path.endsWith('.js')) return match;
          return match.replace(path, path + '.js');
        }
      );
      
      await writeFile(filePath, content);
    }
  }
}

fixImports('./dist');