// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCIwEb6uMDtHZLwhOhKQcADJlgTsM4CygE",
    authDomain: "modelo-store.firebaseapp.com",
    projectId: "modelo-store",
    storageBucket: "modelo-store.firebasestorage.app",
    messagingSenderId: "312366815849",
    appId: "1:312366815849:web:5aa35554c5df9836b460f8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

//Definição de TELA
const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const loginErro = document.getElementById("login-erro");

//Definição de SEÇÕES
const secoes = document.querySelectorAll(".secao");
const botoesNav = document.querySelectorAll(".nav-item");


/* ====================================================================
   AUTENTICAÇÃO (login / criar conta / sair)
   ==================================================================== */
document.getElementById("botao-entrar").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    signInWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = "E-mail ou senha inválidos.";
        });
});

document.getElementById("login-senha").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") {
        document.getElementById("botao-entrar").click();
    }
});

document.getElementById("botao-criar-conta").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    console.log("Email:", email);
    console.log("Senha:", senha);

    createUserWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = erro.message;
        });
});

document.getElementById("botao-sair").addEventListener("click", function () {
    signOut(auth);
});

//Sincronização
let pararDeEscutar = null;

onAuthStateChanged(auth, function (usuario) {
    if (usuario) {
        telaLogin.style.display = "none";
        telaApp.style.display = "block";
        textoUsuarioLogado.textContent = usuario.email;



    } else {
        telaLogin.style.display = "block";
        telaApp.style.display = "none";

        if (pararDeEscutar) {
            pararDeEscutar(); // evita continuar escutando dados de uma sessão encerrada
        }

    }
});

//Usuário Logado
const textoUsuarioLogado = document.getElementById("texto-usuario-logado");


// Controla qual <section> fica visível, com base no data-secao do botão
function mostrarSecao(nomeSecao) {

    secoes.forEach(function (secao) {
        secao.style.display = secao.id === "secao-" + nomeSecao ? "block" : "none";
    });

    botoesNav.forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.secao === nomeSecao);
    });
}

botoesNav.forEach(function (botao) {
    botao.addEventListener("click", function () {
        mostrarSecao(botao.dataset.secao);
    });
});

mostrarSecao("compras"); // mostra a seção de produtos por padrão

/* ====================================================================
   REFERÊNCIAS: FORMULÁRIO, PAGINAÇÃO, FILTROS, MODAL, IMPORTAÇÃO
   ==================================================================== */

const form = document.getElementById("form-lancamento");
const lista = document.getElementById("lista-lancamentos");
const modal = document.getElementById("modal-compra");
const modalTitulo = document.getElementById("modal-titulo");
const botaoNovoLancamento = document.getElementById("botao-novo-compra");
const botaoFecharModal = document.getElementById("botao-fechar-modal");
let indiceEmEdicao = null; // null = criando um novo; número = editando esse índice

/* ---------- Modal: reaproveitado tanto para criar quanto editar ---------- */
function abrirModal(titulo) {
    modalTitulo.textContent = titulo;
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    form.reset();
    indiceEmEdicao = null;
    form.querySelector("button[type=submit]").textContent = "Adicionar";
}

botaoNovoLancamento.addEventListener("click", function () {
    abrirModal("Nova Compra", true);
});

botaoFecharModal.addEventListener("click", fecharModal);

// Fecha o modal ao clicar na área escurecida fora do card (mas não ao
// clicar dentro do formulário) — checagem via evento.target === modal
modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        fecharModal();
    }
});

/* ====================================================================
   ENVIO DO FORMULÁRIO (criar, editar, ou criar em série/repetição)
   ==================================================================== */

function calcularTotal(preco, frete, quantidade) {
    return (preco * quantidade) + frete;
}

form.addEventListener("submit", async function (evento) {
    evento.preventDefault(); // evita o comportamento padrão de recarregar a página

    const preco = parseFloat(document.getElementById("preco").value);
    const frete = parseFloat(document.getElementById("frete").value);
    const quantidade = parseInt(document.getElementById("quantidade").value);
    const dataPedido = document.getElementById("dataPedido").value;

    // Dados comuns a todos os casos (novo, edição, ou cada cópia de uma repetição)
    const dadosBase = {
        uid: auth.currentUser.uid,
        lote: parseInt(document.getElementById("lote").value),
        dataPedido: document.getElementById("dataPedido").value,
        preco: parseFloat(document.getElementById("preco").value),
        frete: parseFloat(document.getElementById("frete").value),
        quantidade: parseInt(document.getElementById("quantidade").value),
        total: calcularTotal(preco, frete, quantidade),
        entrega: document.getElementById("entrega").value,
        dataEntrega: document.getElementById("dataEntrega").value,
    };

    console.log(dadosBase)

    if (indiceEmEdicao === null) {
        await addDoc(collection(db, "compras"), { ...dadosBase, data: dataPedido });
    } else {
        // Editando um lançamento existente: atualiza o documento pelo ID salvo
        const idDocumento = lancamentos[indiceEmEdicao].id;
        await updateDoc(doc(db, "compras", idDocumento), { ...dadosBase, data: dataPedido });
        indiceEmEdicao = null;
        form.querySelector("button[type=submit]").textContent = "Adicionar";
    }


    form.reset();
    fecharModal();
});