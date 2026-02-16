#!/bin/bash

cd "/home/brayan/test-oposiciones/Test/Gestion/Gestion-2"

for file in *.txt; do
  # Extraer el número del tema
  numero=$(echo "$file" | grep -oP '\d+' | head -1)
  # Renombrar al formato test_tema_X.txt
  sudo mv "$file" "test_tema_${numero}.txt"
done

echo "Archivos renombrados en Gestion-2:"
ls
