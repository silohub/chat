#!/bin/bash

echo ""
echo "Restaurando paquetes npm del frontend"
echo ""
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "Error al restaurar paquetes npm del frontend"
    exit $?
fi

echo ""
echo "Iniciando frontend en modo desarrollo"
echo ""
npm run dev &
if [ $? -ne 0 ]; then
    echo "Error al iniciar el frontend"
    exit $?
fi

cd ..
. ./scripts/loadenv.sh

echo ""
echo "Iniciando backend con recarga automática"
echo ""
./.venv/bin/python -m quart run --port=50505 --host=127.0.0.1 --reload
if [ $? -ne 0 ]; then
    echo "Error al iniciar el backend"
    exit $?
fi
