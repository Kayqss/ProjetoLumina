import React from "react";
import "./Card.css";

function Card({ number, title, description, actionText, onClick, icon }) {
  return (
    <div className="card">
      <div className="card-number">{number}</div>

      <div className="card-title-with-icon">
        {icon && <img src={icon} alt="Ícone" className="card-icon" />}
        <h3 className="card-title">{title}</h3>
      </div>

      <p className="card-description">{description}</p>

      {actionText && (
        <button className="card-action" onClick={onClick}>
          {actionText}
        </button>
      )}
    </div>
  );
}

export default Card;
