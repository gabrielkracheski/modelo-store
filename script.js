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
let compras = []
let pararDeEscutar = null;
let selecionados = new Set();

onAuthStateChanged(auth, function (usuario) {
    if (usuario) {
        telaLogin.style.display = "none";
        telaApp.style.display = "block";
        textoUsuarioLogado.textContent = usuario.email;

        // Só busca (e escuta) os documentos que pertencem a este usuário
        const consulta = query(
            collection(db, "compras"),
            where("uid", "==", usuario.uid)
        );

        // onSnapshot = "escuta ao vivo": roda de novo automaticamente
        // toda vez que os dados mudam no Firestore, em qualquer dispositivo
        pararDeEscutar = onSnapshot(consulta, function (snapshot) {
            compras = snapshot.docs.map(function (documento) {
                return { id: documento.id, ...documento.data() };
            });

            renderizar();
            //renderizarResumo();
            //renderizarResumoAnual();
            //preencherSeletorMeses();
            //renderizarDashboard();
        });

    } else {
        telaLogin.style.display = "block";
        telaApp.style.display = "none";

        if (pararDeEscutar) {
            pararDeEscutar(); // evita continuar escutando dados de uma sessão encerrada
        }
        compras = [];
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
const lista = document.getElementById("lista-compras");
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
function formatarMoeda(valor) {
    return "R$ " + valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return dia + "-" + mes + "-" + ano;
}

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

    if (indiceEmEdicao === null) {
        await addDoc(collection(db, "compras"), { ...dadosBase, data: dataPedido });
    } else {
        // Editando um lançamento existente: atualiza o documento pelo ID salvo
        const idDocumento = compras[indiceEmEdicao].id;
        await updateDoc(doc(db, "compras", idDocumento), { ...dadosBase, data: dataPedido });
        indiceEmEdicao = null;
        form.querySelector("button[type=submit]").textContent = "Adicionar";
    }


    form.reset();
    fecharModal();
});

//Renderização COMPRAS
/* ---------- Editar: preenche o formulário com os dados do item clicado ---------- */
function editarLancamento(indice) {
    const item = compras[indice];

    document.getElementById("lote").value = item.lote;
    document.getElementById("dataPedido").value = item.dataPedido;
    document.getElementById("preco").value = item.preco;
    document.getElementById("frete").value = item.frete;
    document.getElementById("quantidade").value = item.quantidade;
    document.getElementById("entrega").value = item.entrega;
    document.getElementById("dataEntrega").value = item.dataEntrega;

    indiceEmEdicao = indice;
    form.querySelector("button[type=submit]").textContent = "Salvar alteração";
    abrirModal("Editar Lançamento", false);
}

/* ---------- Exclusão individual ---------- */
async function excluirLancamento(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");
   
    if (!confirmar) return;

    const idDocumento = compras[indice].id;
    await deleteDoc(doc(db, "compras", idDocumento));
    // Não precisa chamar renderizar() aqui: o onSnapshot detecta a
    // exclusão no Firestore e atualiza a tela sozinho
}

function renderizar() {
    lista.innerHTML = "";

    const lancamentosFiltrados = compras

    lancamentosFiltrados.forEach(function (item) {
        const linha = document.createElement("tr");

        // Checkbox de seleção: nasce marcado/desmarcado consultando o
        // Set "selecionados" — ele é sempre a fonte da verdade, não o DOM
        const celulaSelecionar = document.createElement("td");
        const checkboxLinha = document.createElement("input");
        checkboxLinha.type = "checkbox";
        checkboxLinha.checked = selecionados.has(item.id);
        checkboxLinha.addEventListener("change", function () {
            if (checkboxLinha.checked) {
                selecionados.add(item.id);
            } else {
                selecionados.delete(item.id);
            }
            
        });
        celulaSelecionar.appendChild(checkboxLinha);

        const celulaLote = document.createElement("td");
        celulaLote.textContent = item.lote;

        const celulaDataPedido = document.createElement("td");
        celulaDataPedido.textContent = formatarData(item.dataPedido);

        const celulaPreco = document.createElement("td");
        celulaPreco.textContent = formatarMoeda(item.preco);

        const celulaFrete = document.createElement("td");
        celulaFrete.textContent = formatarMoeda(item.frete);

        const celulaQuantidade = document.createElement("td");
        celulaQuantidade.textContent = item.quantidade;

        const celulaTotal = document.createElement("td");
        celulaTotal.textContent = formatarMoeda(item.total);

        const celulaEntrega = document.createElement("td");
        celulaEntrega.textContent = item.entrega;

        const celulaDataEntrega = document.createElement("td");
        celulaDataEntrega.textContent = item.dataEntrega ? formatarData(item.dataEntrega) : "----------------";

        const celulaAcoes = document.createElement("td");
        const botaoEditar = document.createElement("button");
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", function () {
            const indiceReal = compras.indexOf(item);
            editarLancamento(indiceReal);
        });

        const botaoExcluir = document.createElement("button");
        botaoExcluir.textContent = "Excluir";
        botaoExcluir.addEventListener("click", function () {
            const indiceReal = compras.indexOf(item);
            excluirLancamento(indiceReal);
        });

        celulaAcoes.appendChild(botaoEditar);
        celulaAcoes.appendChild(botaoExcluir);

        linha.appendChild(celulaSelecionar);
        linha.appendChild(celulaLote);
        linha.appendChild(celulaDataPedido);
        linha.appendChild(celulaPreco);
        linha.appendChild(celulaFrete);
        linha.appendChild(celulaQuantidade);
        linha.appendChild(celulaTotal);
        linha.appendChild(celulaEntrega);
        linha.appendChild(celulaDataEntrega);
        linha.appendChild(celulaAcoes);

        lista.appendChild(linha);
    });

}
