import { getAllItems, addItem } from './database.js';
import { v4 as uuidv4 } from 'uuid'; // Precisaremos adicionar essa lib no package.json

export async function seedData() {
  const motivos = await getAllItems('motivos');
  if (motivos.length === 0) {
    const motivosIniciais = [
      { nome: 'Entrada', natureza: 'trabalho', ordem: 1 },
      { nome: 'Pausa Café', natureza: 'pausa', ordem: 2 },
      { nome: 'Retorno Café', natureza: 'trabalho', ordem: 3 },
      { nome: 'Almoço', natureza: 'pausa', ordem: 4 },
      { nome: 'Retorno Almoço', natureza: 'trabalho', ordem: 5 },
      { nome: 'Pausa Café Tarde', natureza: 'pausa', ordem: 6 },
      { nome: 'Retorno Café Tarde', natureza: 'trabalho', ordem: 7 },
      { nome: 'Janta', natureza: 'pausa', ordem: 8 },
      { nome: 'Retorno Janta', natureza: 'trabalho', ordem: 9 },
      { nome: 'Saída Final', natureza: 'pausa', ordem: 10 },
    ];

    for (const motivo of motivosIniciais) {
      await addItem('motivos', { id: uuidv4(), ...motivo, ativo: true });
    }
    console.log('Motivos iniciais cadastrados.');
  }
}